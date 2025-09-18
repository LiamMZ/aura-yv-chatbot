#!/usr/bin/env python3
"""
Heroku Startup Script
Downloads vector stores from S3 before starting the application
Integrates with the existing RAG pipeline configuration
"""
import os
import sys
import logging
from pathlib import Path
from typing import List, Dict, Any

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "src"))

# Simple S3 download functionality without complex dependencies
try:
    import boto3
    from botocore.exceptions import ClientError
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False
    boto3 = None
    ClientError = Exception

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class HerokuStartup:
    """Handles startup tasks for Heroku deployment"""
    
    def __init__(self):
        self.vector_stores_config = [
            {
                's3_prefix': 'vector_stores/enhanced_yale_ventures_openai',
                'local_path': 'scripts/packaging/vector_stores/enhanced_yale_ventures_openai'
            },
            {
                's3_prefix': 'vector_stores/notion_rag_openai',
                'local_path': 'scripts/packaging/vector_stores/notion_rag_openai'
            }
        ]
        
    def check_environment(self) -> bool:
        """Check if required environment variables and boto3 are available"""
        if not HAS_BOTO3:
            logger.warning("boto3 not available - skipping S3 download")
            return False
            
        required_vars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME']
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        
        if missing_vars:
            logger.warning(f"Missing environment variables: {missing_vars}")
            logger.info("Skipping S3 download - using local vector stores if available")
            return False
            
        return True
    
    def download_vector_stores(self) -> Dict[str, Any]:
        """Download vector stores from S3"""
        if not self.check_environment():
            return {"status": "skipped", "reason": "Missing AWS credentials or boto3"}
        
        try:
            # Initialize S3 client directly
            s3_client = boto3.client(
                's3',
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                region_name=os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
            )
            bucket_name = os.getenv('S3_BUCKET_NAME')
            
            results = []
            
            for config in self.vector_stores_config:
                s3_prefix = config['s3_prefix']
                local_path = config['local_path']
                
                logger.info(f"Downloading {s3_prefix} to {local_path}")
                
                try:
                    downloaded_files = self._download_s3_prefix(s3_client, bucket_name, s3_prefix, local_path)
                    results.append({
                        "s3_prefix": s3_prefix,
                        "local_path": local_path,
                        "files_downloaded": len(downloaded_files),
                        "status": "success"
                    })
                    logger.info(f"Successfully downloaded {len(downloaded_files)} files for {s3_prefix}")
                    
                except Exception as e:
                    logger.error(f"Failed to download {s3_prefix}: {e}")
                    results.append({
                        "s3_prefix": s3_prefix,
                        "local_path": local_path,
                        "files_downloaded": 0,
                        "status": "failed",
                        "error": str(e)
                    })
            
            return {"status": "completed", "results": results}
            
        except Exception as e:
            logger.error(f"Failed to initialize S3 client: {e}")
            return {"status": "failed", "error": str(e)}
    
    def _download_s3_prefix(self, s3_client, bucket_name: str, s3_prefix: str, local_path: str) -> List[str]:
        """Download all files with given S3 prefix to local path"""
        local_path = Path(local_path)
        local_path.mkdir(parents=True, exist_ok=True)
        
        # List all objects with the prefix
        response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=s3_prefix)
        
        if 'Contents' not in response:
            logger.warning(f"No files found with prefix {s3_prefix}")
            return []
        
        downloaded_files = []
        for obj in response['Contents']:
            s3_key = obj['Key']
            # Remove prefix to get relative path
            relative_path = s3_key[len(s3_prefix):].lstrip('/')
            if not relative_path:  # Skip if it's just the prefix itself
                continue
                
            local_file_path = local_path / relative_path
            
            # Create parent directories
            local_file_path.parent.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"Downloading s3://{bucket_name}/{s3_key} to {local_file_path}")
            s3_client.download_file(bucket_name, s3_key, str(local_file_path))
            downloaded_files.append(str(local_file_path))
        
        return downloaded_files
    
    def verify_vector_stores(self) -> Dict[str, Any]:
        """Verify that vector stores exist locally"""
        verification_results = []
        
        for config in self.vector_stores_config:
            local_path = Path(config['local_path'])
            
            if local_path.exists():
                # Check for required files
                index_file = local_path / "index.faiss"
                metadata_file = local_path / "metadata.json"
                nodes_file = local_path / "nodes.pkl"
                
                files_present = {
                    "index.faiss": index_file.exists(),
                    "metadata.json": metadata_file.exists(),
                    "nodes.pkl": nodes_file.exists()
                }
                
                all_files_present = all(files_present.values())
                
                verification_results.append({
                    "local_path": str(local_path),
                    "directory_exists": True,
                    "files_present": files_present,
                    "complete": all_files_present,
                    "status": "ready" if all_files_present else "incomplete"
                })
                
                if all_files_present:
                    logger.info(f"✅ Vector store ready: {local_path}")
                else:
                    logger.warning(f"⚠️  Incomplete vector store: {local_path} - missing {[k for k, v in files_present.items() if not v]}")
                    
            else:
                verification_results.append({
                    "local_path": str(local_path),
                    "directory_exists": False,
                    "files_present": {},
                    "complete": False,
                    "status": "missing"
                })
                logger.warning(f"❌ Vector store missing: {local_path}")
        
        return {"verification_results": verification_results}
    
    def run_startup(self) -> Dict[str, Any]:
        """Run the complete startup process"""
        logger.info("🚀 Starting Heroku startup process")
        
        # Step 1: Download vector stores from S3
        download_result = self.download_vector_stores()
        logger.info(f"Download result: {download_result['status']}")
        
        # Step 2: Verify vector stores
        verification_result = self.verify_vector_stores()
        
        # Check if any vector stores are ready
        ready_stores = [r for r in verification_result['verification_results'] if r['status'] == 'ready']
        incomplete_stores = [r for r in verification_result['verification_results'] if r['status'] in ['incomplete', 'missing']]
        
        logger.info(f"Vector stores ready: {len(ready_stores)}")
        if incomplete_stores:
            logger.warning(f"Vector stores with issues: {len(incomplete_stores)}")
        
        # Set environment variables for the application
        if ready_stores:
            # Use the first ready vector store as primary
            primary_store = ready_stores[0]['local_path']
            os.environ['EXISTING_VECTOR_STORE_PATH'] = primary_store
            logger.info(f"Set EXISTING_VECTOR_STORE_PATH to: {primary_store}")
            
            # Set fallback if available
            if len(ready_stores) > 1:
                fallback_store = ready_stores[1]['local_path']
                os.environ['EXISTING_VECTOR_STORE_FALLBACK_PATH'] = fallback_store
                logger.info(f"Set EXISTING_VECTOR_STORE_FALLBACK_PATH to: {fallback_store}")
        
        logger.info("✅ Startup process completed")
        
        return {
            "download_result": download_result,
            "verification_result": verification_result,
            "ready_stores": len(ready_stores),
            "status": "completed"
        }

def main():
    """Main function for running startup script"""
    startup = HerokuStartup()
    result = startup.run_startup()
    
    if result['ready_stores'] == 0:
        logger.error("❌ No vector stores are ready - application may not work properly")
        # Don't exit with error code as Heroku would fail to start
        # Instead, let the application handle missing vector stores gracefully
    
    return 0

if __name__ == '__main__':
    exit(main())