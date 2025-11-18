"""Public Reaction Handler for collecting anonymous viewer reactions"""

import hashlib
import time
import uuid
from typing import Dict, Optional
import logging
import json
import os

logger = logging.getLogger(__name__)

class PublicReactionManager:
    """Manages public reaction links and data collection"""
    
    def __init__(self, storage_path: str = "data/public_reactions.json"):
        self.storage_path = storage_path
        self.reactions_data = self._load_reactions()
        
    def _load_reactions(self) -> Dict:
        """Load existing public reactions data"""
        try:
            if os.path.exists(self.storage_path):
                with open(self.storage_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load public reactions: {e}")
        
        return {"links": {}, "reactions": {}}
    
    def _save_reactions(self):
        """Save reactions data"""
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            with open(self.storage_path, 'w') as f:
                json.dump(self.reactions_data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save public reactions: {e}")
    
    def generate_shareable_link(self, video_id: str, analysis_id: str) -> str:
        """Generate a unique shareable link for a video"""
        # Create unique link ID
        link_data = f"{video_id}_{analysis_id}_{time.time()}"
        link_id = hashlib.sha256(link_data.encode()).hexdigest()[:16]
        
        # Store link info
        self.reactions_data["links"][link_id] = {
            "video_id": video_id,
            "analysis_id": analysis_id,
            "created_at": time.time(),
            "reactions_count": 0,
            "active": True
        }
        self._save_reactions()
        
        return link_id
    
    def get_link_info(self, link_id: str) -> Optional[Dict]:
        """Get information about a shareable link"""
        return self.reactions_data["links"].get(link_id)
    
    def save_public_reaction(self, link_id: str, age: int, gender: str, emotion_data: Dict) -> str:
        """Save a public reaction without storing images"""
        link_info = self.get_link_info(link_id)
        if not link_info or not link_info.get("active"):
            raise ValueError("Invalid or inactive link")
        
        # Generate reaction ID
        reaction_id = str(uuid.uuid4())
        
        # Save reaction data (no images, just anonymized data)
        reaction_data = {
            "reaction_id": reaction_id,
            "link_id": link_id,
            "video_id": link_info["video_id"],
            "analysis_id": link_info["analysis_id"],
            "timestamp": time.time(),
            "demographics": {
                "age": age,
                "gender": gender
            },
            "emotion_data": emotion_data,
            "anonymized": True
        }
        
        self.reactions_data["reactions"][reaction_id] = reaction_data
        
        # Update link stats
        self.reactions_data["links"][link_id]["reactions_count"] += 1
        self._save_reactions()
        
        logger.info(f"Saved public reaction {reaction_id} for link {link_id}")
        return reaction_id
    
    def get_reactions_for_video(self, analysis_id: str) -> list:
        """Get all public reactions for a video analysis"""
        reactions = []
        for reaction in self.reactions_data["reactions"].values():
            if reaction.get("analysis_id") == analysis_id:
                reactions.append(reaction)
        
        return sorted(reactions, key=lambda x: x["timestamp"], reverse=True)
    
    def deactivate_link(self, link_id: str):
        """Deactivate a shareable link"""
        if link_id in self.reactions_data["links"]:
            self.reactions_data["links"][link_id]["active"] = False
            self._save_reactions() 