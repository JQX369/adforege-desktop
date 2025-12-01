"""Clearcast guidelines updater - checks for updates weekly using AI"""

import os
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
import threading
import time

import google.generativeai as genai

from .clearcast_rules import ClearcastRulesSnapshot

logger = logging.getLogger(__name__)


def _default_snapshot() -> Dict[str, Any]:
    return {
        "version_id": "v1.0.0",
        "last_checked": None,
        "source_document": None,
        "rules": [],
    }


def _default_history() -> Dict[str, Any]:
    history = {
        "last_check": None,
        "updates": [],
        "current_version": "v1.0.0",
        "auto_check_enabled": True,
        "snapshot": _default_snapshot(),
    }
    return history


def _ensure_snapshot_structure(history: Dict[str, Any]) -> None:
    snapshot = history.get("snapshot")
    if not isinstance(snapshot, dict):
        history["snapshot"] = _default_snapshot()
        snapshot = history["snapshot"]

    snapshot.setdefault("version_id", history.get("current_version", "v1.0.0"))
    snapshot.setdefault("last_checked", history.get("last_check"))
    snapshot.setdefault("source_document", None)
    snapshot.setdefault("rules", [])


def _clean_iso(timestamp: Optional[str]) -> Optional[str]:
    if not timestamp:
        return None
    if timestamp.endswith("Z"):
        return timestamp.replace("Z", "+00:00")
    return timestamp


def _format_last_updated_text(snapshot: Dict[str, Any], fallback: Optional[str]) -> str:
    timestamp = snapshot.get("last_checked") or fallback
    if not timestamp:
        return "Clearcast rules last updated: never"

    formatted = timestamp
    cleaned = _clean_iso(timestamp)
    if cleaned:
        try:
            dt = datetime.fromisoformat(cleaned)
            formatted = dt.strftime("%d %b %Y %H:%M UTC")
        except ValueError:
            formatted = timestamp

    return f"Clearcast rules last updated: {formatted}"

class ClearcastUpdater:
    """Manages checking for Clearcast guideline updates"""
    
    def __init__(self, api_key: str, updates_path: Optional[Path] = None):
        """Initialize the updater"""
        self.api_key = api_key
        genai.configure(api_key=api_key)
        # Initialize Gemini model using utility function with automatic fallback
        from app.core.gemini_utils import create_gemini_model
        self.model = create_gemini_model('flash', api_key, fallback_to_pro=True)
        
        if not self.model:
            logger.warning("Failed to initialize Gemini model for Clearcast updater")
        
        # Paths
        self.app_dir = Path(__file__).parent
        self.updates_file = Path(updates_path) if updates_path else self.app_dir / "clearcast_updates.json"
        self.guidelines_file = self.app_dir.parent / "A Complete Guide to Passing TV Adverts_ Key Clearcast Guidance.pdf"
        
        # Load update history
        self.update_history = self._load_update_history()
        
    def _load_update_history(self) -> Dict:
        """Load update history from file"""
        if self.updates_file.exists():
            try:
                with open(self.updates_file, 'r') as f:
                    history = json.load(f)
                    _ensure_snapshot_structure(history)
                    return history
            except:
                logger.warning("Failed to load Clearcast update history; creating defaults")
        
        history = _default_history()
        _ensure_snapshot_structure(history)
        return history
    
    def _save_update_history(self):
        """Save update history to file"""
        try:
            with open(self.updates_file, 'w') as f:
                json.dump(self.update_history, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save update history: {e}")

    def _touch_snapshot(self, timestamp_iso: str, bump_version: bool = False):
        """Update snapshot metadata with the latest timestamp and optional version bump."""
        snapshot = self.update_history.setdefault('snapshot', _default_snapshot())
        snapshot['last_checked'] = timestamp_iso
        
        if bump_version:
            snapshot['version_id'] = self._bump_version()
        elif not snapshot.get('version_id'):
            snapshot['version_id'] = self.update_history.get('current_version', 'v1.0.0')

    def _bump_version(self) -> str:
        """Increment the semantic version patch for the snapshot."""
        current = self.update_history.get('current_version', 'v1.0.0')
        try:
            parts = current.lstrip('v').split('.')
            while len(parts) < 3:
                parts.append('0')
            major, minor, patch = [int(p) for p in parts[:3]]
            patch += 1
            new_version = f"v{major}.{minor}.{patch}"
        except ValueError:
            new_version = 'v1.0.1'
        
        self.update_history['current_version'] = new_version
        return new_version

    def get_rules_snapshot(self) -> ClearcastRulesSnapshot:
        """Return the typed rules snapshot for downstream components."""
        return ClearcastRulesSnapshot.from_dict(self.update_history)

    def get_last_updated_text(self) -> str:
        """Return a human-friendly string to display in the UI."""
        snapshot = self.update_history.get('snapshot', {})
        return _format_last_updated_text(snapshot, self.update_history.get('last_check'))
    
    def check_for_updates(self) -> Dict:
        """Check for Clearcast guideline updates"""
        logger.info("Checking for Clearcast updates...")
        
        results = {
            'has_updates': False,
            'changes': [],
            'summary': '',
            'checked_at': datetime.now().isoformat()
        }
        
        # Check if model is available
        if not self.model:
            logger.error("Gemini model not available for update check")
            results['summary'] = "Update check failed: Gemini model not initialized"
            return results
        
        try:
            # Create search prompt
            prompt = f"""
            You are a broadcast compliance expert. Search for the latest Clearcast TV advertising guidelines updates for {datetime.now().year}.
            
            Focus on:
            1. Any new rules or changes to existing rules for TV advertisements
            2. Technical specification updates (audio levels, video formats, etc.)
            3. Content restrictions or new prohibited content
            4. Changes to submission requirements
            
            Please provide:
            - A list of specific changes (if any)
            - Whether these are major or minor updates
            - The effective date of changes
            
            If no recent updates are found, just say "No recent updates found."
            
            Format your response as JSON:
            {{
                "has_updates": true/false,
                "changes": [
                    {{
                        "type": "major/minor",
                        "category": "technical/content/process",
                        "description": "...",
                        "effective_date": "YYYY-MM-DD"
                    }}
                ],
                "summary": "Brief summary of all changes"
            }}
            """
            
            response = self.model.generate_content(prompt)
            
            # Parse response
            try:
                # Extract JSON from response
                text = response.text
                json_start = text.find('{')
                json_end = text.rfind('}') + 1
                
                if json_start >= 0 and json_end > json_start:
                    json_text = text[json_start:json_end]
                    data = json.loads(json_text)
                    
                    results['has_updates'] = data.get('has_updates', False)
                    results['changes'] = data.get('changes', [])
                    results['summary'] = data.get('summary', '')
                    
                    # Save update record
                    if results['has_updates']:
                        update_record = {
                            'date': datetime.now().isoformat(),
                            'changes': results['changes'],
                            'summary': results['summary']
                        }
                        self.update_history['updates'].append(update_record)
                        
            except Exception as e:
                logger.error(f"Failed to parse update response: {e}")
                results['summary'] = "Error checking for updates"
            
            # Update last check time + snapshot metadata
            self.update_history['last_check'] = results['checked_at']
            self._touch_snapshot(results['checked_at'], bump_version=results['has_updates'])
            self._save_update_history()
            
        except Exception as e:
            logger.error(f"Update check failed: {e}")
            results['summary'] = f"Update check failed: {str(e)}"
        
        return results
    
    def should_check_updates(self) -> bool:
        """Determine if we should check for updates"""
        if not self.update_history['auto_check_enabled']:
            return False
            
        last_check = self.update_history.get('last_check')
        if not last_check:
            return True
            
        try:
            last_check_date = datetime.fromisoformat(last_check)
            days_since_check = (datetime.now() - last_check_date).days
            return days_since_check >= 7  # Weekly check
        except:
            return True
    
    def get_update_summary(self) -> str:
        """Get a summary of recent updates"""
        if not self.update_history['updates']:
            return "No updates recorded"
            
        # Get updates from last 30 days
        recent_updates = []
        cutoff_date = datetime.now() - timedelta(days=30)
        
        for update in self.update_history['updates']:
            try:
                update_date = datetime.fromisoformat(update['date'])
                if update_date > cutoff_date:
                    recent_updates.append(update)
            except:
                continue
        
        if not recent_updates:
            return "No recent updates in the last 30 days"
            
        # Format summary
        summary = f"Recent updates ({len(recent_updates)} total):\n\n"
        
        for update in recent_updates[-3:]:  # Show last 3 updates
            date = datetime.fromisoformat(update['date']).strftime('%Y-%m-%d')
            summary += f"**{date}**: {update['summary']}\n"
            
        return summary
    
    def apply_updates_to_checker(self, _clearcast_checker) -> bool:
        """Apply any updates to the Clearcast checker prompt"""
        # This could be enhanced to actually modify the checker's behavior
        # based on updates, but for now we'll just log
        logger.info("Checking if Clearcast checker needs updates...")
        
        # Could implement logic to update the checker's prompts based on
        # the changes detected
        return True
    
    def start_background_checker(self, callback=None):
        """Start background thread to check for updates periodically"""
        def check_loop():
            while True:
                if self.should_check_updates():
                    logger.info("Running scheduled Clearcast update check...")
                    results = self.check_for_updates()
                    
                    if callback and results['has_updates']:
                        callback(results)
                
                # Check every 24 hours
                time.sleep(86400)
        
        thread = threading.Thread(target=check_loop, daemon=True)
        thread.start()
        logger.info("Started Clearcast update checker background thread")
    
    def manually_check_updates(self) -> Dict:
        """Manually trigger an update check"""
        return self.check_for_updates()
    
    def toggle_auto_updates(self, enabled: bool):
        """Enable or disable automatic update checks"""
        self.update_history['auto_check_enabled'] = enabled
        self._save_update_history()
        logger.info(f"Automatic updates {'enabled' if enabled else 'disabled'}") 