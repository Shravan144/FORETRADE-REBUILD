import pytest
from app.services.lead_service import DomainError,change_stage
def test_cannot_mark_replied_without_reply_received_event():
 with pytest.raises(DomainError,match='required_event_missing'):change_stage('replied','note')
