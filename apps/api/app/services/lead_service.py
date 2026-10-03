class DomainError(Exception):pass
REQUIRED_EVENT_FOR_STAGE={'replied':'reply_received','meeting':'meeting'}
def change_stage(target:str,event_type:str)->str:
 if target in REQUIRED_EVENT_FOR_STAGE and event_type!=REQUIRED_EVENT_FOR_STAGE[target]:raise DomainError('required_event_missing')
 return target
