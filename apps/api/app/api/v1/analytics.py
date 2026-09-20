from fastapi import APIRouter
router=APIRouter(prefix='/api/v1/workspaces',tags=['analytics'])
@router.get('/{workspace_id}/analytics')
def analytics(workspace_id:str):return {'pipeline':{'replied':0},'import_quality':{},'score_distribution':{}}
@router.post('/{workspace_id}/exports/companies')
def export(workspace_id:str):return {'job_id':f'export-{workspace_id}'}
