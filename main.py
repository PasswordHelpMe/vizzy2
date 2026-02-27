import os
import logging
import asyncio
from typing import Literal, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import pyvizio

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Vizio TV API",
    description="API for controlling Vizio smart TVs using pyvizio",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class PowerRequest(BaseModel):
    power: str = Field(..., description="Power state: 'on' or 'off'")

class VolumeRequest(BaseModel):
    volume: int = Field(..., ge=0, le=100, description="Volume level (0-100)")

class InputRequest(BaseModel):
    input_name: str = Field(..., description="Input name (e.g., 'HDMI-1', 'SMARTCAST')")

class AppRequest(BaseModel):
    app_name: str = Field(..., description="App name to launch")

class RemoteKeyRequest(BaseModel):
    key: Literal["UP", "DOWN", "LEFT", "RIGHT", "OK"] = Field(
        ..., description="Remote key: UP, DOWN, LEFT, RIGHT, OK"
    )

# Global TV instance
tv_instance: Optional[pyvizio.Vizio] = None

def get_tv_instance() -> pyvizio.Vizio:
    """Get or create TV instance with environment variables"""
    global tv_instance

    if tv_instance is None:
        ip = os.getenv("VIZIO_IP")
        port = int(os.getenv("VIZIO_PORT", "7345"))
        auth_token = os.getenv("VIZIO_AUTH_TOKEN")

        if not ip:
            raise HTTPException(status_code=500, detail="VIZIO_IP environment variable not set")

        # Debug logging
        logger.info(f"Initializing TV connection to {ip}:{port}")
        logger.info(f"Auth token length: {len(auth_token) if auth_token else 0}")
        logger.info(f"Auth token set: {bool(auth_token)}")

        # Use correct pyvizio initialization parameters
        try:
            # device_id, ip, name, auth_token, device_type, timeout
            tv_instance = pyvizio.Vizio(
                device_id=ip,  # Use IP as device_id
                ip=f"{ip}:{port}",
                name="Vizio TV",
                auth_token=auth_token or "",
                device_type='tv',
                timeout=10
            )
            logger.info("TV instance created successfully with correct parameters")
        except Exception as e:
            logger.warning(f"Failed with correct parameters: {e}")
            # Fallback to speaker device type
            tv_instance = pyvizio.Vizio(
                device_id=ip,
                ip=f"{ip}:{port}",
                name="Vizio TV",
                auth_token=auth_token or "",
                device_type='speaker',
                timeout=10
            )
            logger.info(f"TV instance created successfully with speaker device type")

    return tv_instance

async def run_sync_method(method, *args, **kwargs):
    """Run a sync method in a thread pool to avoid blocking"""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: method(*args, **kwargs))

@app.on_event("startup")
async def startup_event():
    """Initialize TV connection on startup"""
    try:
        get_tv_instance()
        logger.info("TV API started successfully")
    except Exception as e:
        logger.error(f"Failed to initialize TV connection: {e}")

@app.get("/")
async def root():
    """Serve the frontend UI"""
    return FileResponse("static/index.html")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        tv = get_tv_instance()
        # Simple connection test
        return {
            "status": "healthy",
            "tv_connected": True,
            "tv_ip": os.getenv("VIZIO_IP"),
            "tv_port": os.getenv("VIZIO_PORT", "7345"),
            "auth_token_set": bool(os.getenv("VIZIO_AUTH_TOKEN"))
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "tv_connected": False,
            "error": str(e)
        }

@app.get("/tv/info")
async def get_tv_info():
    """Get comprehensive TV information with interpreted power state"""
    try:
        tv = get_tv_instance()

        # Base info
        info = {
            "ip": os.getenv("VIZIO_IP"),
            "port": os.getenv("VIZIO_PORT", "7345"),
            "auth_token_set": bool(os.getenv("VIZIO_AUTH_TOKEN"))
        }

        # Get power state and interpret it
        try:
            power_mode_raw = await run_sync_method(tv.get_power_state)

            # Interpret power mode values based on Vizio API
            if power_mode_raw == 0:
                power_status = "Off"
            elif power_mode_raw == 1:
                power_status = "On"
            elif power_mode_raw == 2:
                power_status = "Standby"
            else:
                power_status = "Unknown"

            info["power"] = power_status
            info["power_mode"] = power_mode_raw

        except Exception as e:
            logger.error(f"Failed to get power state: {e}")
            info["power"] = "Unknown"
            info["power_mode"] = None
            info["power_error"] = str(e)

        # Get volume
        try:
            volume = await run_sync_method(tv.get_current_volume)
            info["volume"] = volume if volume is not None else 0
        except Exception as e:
            logger.error(f"Failed to get volume: {e}")
            info["volume"] = 0
            info["volume_error"] = str(e)

        # Get current input
        try:
            current_input = await run_sync_method(tv.get_current_input)
            info["input"] = current_input if current_input else "Unknown"
        except Exception as e:
            logger.error(f"Failed to get input: {e}")
            info["input"] = "Unknown"
            info["input_error"] = str(e)

        # Get mute status
        try:
            muted = await run_sync_method(tv.is_muted)
            info["muted"] = bool(muted) if muted is not None else False
        except Exception as e:
            logger.error(f"Failed to get mute state: {e}")
            info["muted"] = False
            info["mute_error"] = str(e)

        return info

    except Exception as e:
        logger.error(f"Failed to get TV info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tv/power")
async def set_power(request: PowerRequest):
    """Set TV power state"""
    try:
        tv = get_tv_instance()
        logger.info(f"Attempting to set power to: {request.power}")

        power = request.power.lower()
        if power not in ("on", "off"):
            raise HTTPException(status_code=400, detail="Power must be 'on' or 'off'")

        if power == "on":
            logger.info("Calling tv.pow_on()")
            result = await run_sync_method(tv.pow_on)
            logger.info(f"pow_on result: {result}")
            message = "TV powered on"
        else:
            logger.info("Calling tv.pow_off()")
            result = await run_sync_method(tv.pow_off)
            logger.info(f"pow_off result: {result}")
            message = "TV powered off"

        logger.info(f"Power operation completed: {message}")
        return {"message": message, "power": power}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to set power: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tv/power")
async def get_power():
    """Get current power state"""
    try:
        tv = get_tv_instance()
        power_state = await run_sync_method(tv.get_power_state)
        return {"power": power_state}
    except Exception as e:
        logger.error(f"Failed to get power state: {e}")
        # Return a more user-friendly error
        if "Empty auth token" in str(e):
            return {
                "error": "Authentication required. Please get your TV's auth token using: pyvizio --ip YOUR_TV_IP discover",
                "power": "unknown"
            }
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tv/volume")
async def set_volume(request: VolumeRequest):
    """Set TV volume"""
    try:
        tv = get_tv_instance()
        # Clamp requested volume to device-supported range
        max_volume = await run_sync_method(tv.get_max_volume)
        target_volume = max(0, min(request.volume, max_volume))

        # First, try the direct audio setting API
        set_ok = await run_sync_method(tv.set_audio_setting, "volume", target_volume)

        # If direct set fails, fall back to step-wise adjustment
        if not set_ok:
            current_volume = await run_sync_method(tv.get_current_volume)
            if current_volume is None:
                raise HTTPException(status_code=500, detail="Could not get current volume")

            diff = target_volume - current_volume
            if diff > 0:
                await run_sync_method(tv.vol_up, diff)
            elif diff < 0:
                await run_sync_method(tv.vol_down, abs(diff))

        # Verify resulting volume
        new_volume = await run_sync_method(tv.get_current_volume)
        if new_volume is None:
            raise HTTPException(status_code=500, detail="Failed to verify new volume")

        return {"message": f"Volume set to {new_volume}", "volume": new_volume}
    except Exception as e:
        logger.error(f"Failed to set volume: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tv/volume")
async def get_volume():
    """Get current volume"""
    try:
        tv = get_tv_instance()
        volume = await run_sync_method(tv.get_current_volume)
        return {"volume": volume}
    except Exception as e:
        logger.error(f"Failed to get volume: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tv/input")
async def set_input(request: InputRequest):
    """Set TV input"""
    try:
        tv = get_tv_instance()
        await run_sync_method(tv.set_input, request.input_name)
        return {"message": f"Input set to {request.input_name}", "input": request.input_name}
    except Exception as e:
        logger.error(f"Failed to set input: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tv/input")
async def get_input():
    """Get current input"""
    try:
        tv = get_tv_instance()
        current_input = await run_sync_method(tv.get_current_input)
        return {"input": current_input}
    except Exception as e:
        logger.error(f"Failed to get input: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tv/inputs")
async def get_available_inputs():
    """Get available inputs"""
    try:
        tv = get_tv_instance()
        inputs = await run_sync_method(tv.get_inputs_list)
        return {"inputs": inputs}
    except Exception as e:
        logger.error(f"Failed to get inputs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tv/app")
async def launch_app(request: AppRequest):
    """Launch an app on the TV"""
    try:
        tv = get_tv_instance()
        await run_sync_method(tv.launch_app, request.app_name)
        return {"message": f"App {request.app_name} launched", "app": request.app_name}
    except Exception as e:
        logger.error(f"Failed to launch app: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tv/apps")
async def get_available_apps():
    """Get available apps"""
    try:
        tv = get_tv_instance()
        apps = await run_sync_method(tv.get_apps_list)
        return {"apps": apps}
    except Exception as e:
        logger.error(f"Failed to get apps: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tv/mute")
async def set_mute(muted: bool = True):
    """Set mute state"""
    try:
        tv = get_tv_instance()
        if muted:
            await run_sync_method(tv.mute_on)
            message = "TV muted"
        else:
            await run_sync_method(tv.mute_off)
            message = "TV unmuted"
        return {"message": message, "muted": muted}
    except Exception as e:
        logger.error(f"Failed to set mute: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tv/mute")
async def get_mute():
    """Get current mute state"""
    try:
        tv = get_tv_instance()
        muted = await run_sync_method(tv.is_muted)
        return {"muted": muted}
    except Exception as e:
        logger.error(f"Failed to get mute state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tv/remote")
async def send_remote_key(request: RemoteKeyRequest):
    """Send a remote key press (UP, DOWN, LEFT, RIGHT, OK)"""
    try:
        tv = get_tv_instance()
        await run_sync_method(tv.remote, request.key)
        return {"message": f"Key '{request.key}' sent", "key": request.key}
    except Exception as e:
        logger.error(f"Failed to send remote key: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Mount static files AFTER all API routes so they don't shadow them
app.mount("/", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
