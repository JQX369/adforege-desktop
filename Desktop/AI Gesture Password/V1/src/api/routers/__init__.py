"""API Routers Package

This package contains all FastAPI routers for the Ad-Forge SaaS platform.
Each router handles a specific domain of the application.

Routers:
    - auth: Authentication (Supabase Auth wrapper)
    - projects: Project/campaign management
    - analyses: Video analysis endpoints
    - reactions: Viewer reaction recording/analysis
    - clearcast: UK broadcast compliance checking
    - scripts: Ad Script Lab (script generation)
    - storyboards: Storyboard generation
    - billing: Stripe subscription management
    - media_reports: Media report parsing (TODO)
    - admin: Platform administration (TODO)
"""

from fastapi import APIRouter

# Create the main v1 router that includes all sub-routers
api_v1_router = APIRouter(prefix="/api/v1")

# Import routers
from .auth import router as auth_router
from .projects import router as projects_router
from .analyses import router as analyses_router
from .reactions import router as reactions_router
from .clearcast import router as clearcast_router
from .scripts import router as scripts_router
from .storyboards import router as storyboards_router
from .billing import router as billing_router

# Include all routers
api_v1_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_v1_router.include_router(projects_router, prefix="/projects", tags=["Projects"])
api_v1_router.include_router(analyses_router, prefix="/analyses", tags=["Analyses"])
api_v1_router.include_router(reactions_router, prefix="/reactions", tags=["Reactions"])
api_v1_router.include_router(clearcast_router, prefix="/clearcast", tags=["Clearcast"])
api_v1_router.include_router(scripts_router, prefix="/scripts", tags=["Ad Script Lab"])
api_v1_router.include_router(storyboards_router, prefix="/storyboards", tags=["Storyboards"])
api_v1_router.include_router(billing_router, prefix="/billing", tags=["Billing"])

# TODO: Add these routers when implemented
# from .media_reports import router as media_reports_router
# from .admin import router as admin_router
# api_v1_router.include_router(media_reports_router, prefix="/media-reports", tags=["Media Reports"])
# api_v1_router.include_router(admin_router, prefix="/admin", tags=["Admin"])

__all__ = ["api_v1_router"]
