from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from typing import List, Optional
import json
import os
import uuid
from pathlib import Path

from app.features.storyboards.models import (
    ScriptInput, AnalysisResult, ClarificationResponse, StoryboardJob, 
    ScriptSource, UploadedAsset
)
from app.features.storyboards.service import storyboard_service

router = APIRouter(prefix="/storyboards", tags=["storyboards"])

# Directory for uploaded assets
ASSETS_DIR = Path("uploads/storyboard_assets")
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/analyze", response_model=AnalysisResult)
async def analyze_script(input_data: ScriptInput):
    """
    Step 1: Analyze script (text or from Ad Script Lab) and generate clarification questions.
    """
    try:
        return await storyboard_service.analyze_script(input_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze/upload", response_model=AnalysisResult)
async def analyze_uploaded_script(
    file: UploadFile = File(...),
):
    """
    Step 1 (Alt): Analyze uploaded script file (TXT/DOCX).
    """
    try:
        content = ""
        filename = file.filename.lower()
        
        if filename.endswith(".txt"):
            content = (await file.read()).decode("utf-8")
        elif filename.endswith(".docx"):
            # For MVP, maybe just text support or use a library if available.
            try:
                content = (await file.read()).decode("utf-8")
            except UnicodeDecodeError:
                 raise HTTPException(status_code=400, detail="Only text files are supported currently.")
        else:
             raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .txt")

        input_data = ScriptInput(
            source=ScriptSource.UPLOAD,
            content=content,
            file_name=file.filename
        )
        return await storyboard_service.analyze_script(input_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate", response_model=StoryboardJob)
async def generate_storyboard(response: ClarificationResponse):
    """
    Step 2: Submit answers to clarification questions and start generation job.
    """
    try:
        return await storyboard_service.start_storyboard_generation(response)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs/{job_id}", response_model=StoryboardJob)
async def get_job_status(job_id: str):
    """
    Poll for job status.
    """
    job = storyboard_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/", response_model=List[StoryboardJob])
async def list_jobs(limit: int = 20):
    """
    List all storyboard jobs.
    """
    return storyboard_service.list_jobs(limit)


@router.post("/assets/upload", response_model=UploadedAsset)
async def upload_asset(
    file: UploadFile = File(...),
    asset_request_id: str = Form(...),
):
    """
    Upload a brand asset (logo, product image, etc.) for use in storyboard generation.
    """
    try:
        # Validate file type
        allowed_types = {
            "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
            "image/svg+xml", "application/pdf"
        }
        content_type = file.content_type or "application/octet-stream"
        
        if content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type: {content_type}. Allowed: images (PNG, JPEG, GIF, WebP, SVG) and PDF."
            )
        
        # Generate unique filename
        ext = Path(file.filename).suffix if file.filename else ".png"
        unique_filename = f"{uuid.uuid4()}{ext}"
        file_path = ASSETS_DIR / unique_filename
        
        # Save file
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Return uploaded asset info
        # In production, this would be a proper URL (e.g., S3, CDN)
        file_url = f"/uploads/storyboard_assets/{unique_filename}"
        
        return UploadedAsset(
            asset_request_id=asset_request_id,
            file_url=file_url,
            file_name=file.filename or unique_filename,
            mime_type=content_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload asset: {str(e)}")
