import uuid
from fastapi import APIRouter, File, HTTPException, UploadFile
router=APIRouter(prefix='/api/v1',tags=['imports'])
_jobs:dict[str,dict[str,str]]={}
@router.post('/workspaces/{workspace_id}/imports',status_code=202)
async def upload(workspace_id:str,file:UploadFile=File(...)):
 name=file.filename or ''
 if not name.lower().endswith(('.csv','.xlsx')): raise HTTPException(422,'Only CSV and XLSX uploads are supported')
 job_id=str(uuid.uuid4());_jobs[job_id]={'id':job_id,'workspace_id':workspace_id,'status':'queued','filename':name};return _jobs[job_id]
@router.get('/jobs/{job_id}')
def job(job_id:str):
 if job_id not in _jobs: raise HTTPException(404,'Job not found')
 return _jobs[job_id]
