import base64
import hashlib
import json

def _encodeToStr(dct):
    assert isinstance(dct, dict)
    res = base64.b64encode(json.dumps(dct).encode('UTF-8')).decode('ASCII')
    assert isinstance(res, str)
    return res

def _decodeFromStr(s):
    assert isinstance(s, str)
    return json.loads(base64.b64decode(s.encode('ASCII')).decode('UTF-8'))

class AbstractNetCore(object):
    def __init__(self, projectManager=None):
        self._projectManager = projectManager
        self._queries = {}

    def _projectManager_set(self, val):
        self._projectManager = val
    projectManager = property(fset=_projectManager_set)

    def query(self, endpoint, projectId, qdata, onAnswer):
        assert isinstance(projectId, str)
        assert isinstance(qdata, dict)

        qbytes = json.dumps(qdata).encode('UTF-8')
        qid = hashlib.sha256(projectId.encode('UTF-8') + qbytes).hexdigest()

        msg = {
            'type': 'query',
            'project': projectId,
            'qid': qid,
            'payload_b64': base64.b64encode(qbytes).decode('ASCII'),
        }
        mbytes = json.dumps(msg).encode('UTF-8')
        self._queries[(id(endpoint), qid)] = onAnswer
        endpoint.send(mbytes)

    def broadcast(self, projectId, qdata):
        assert isinstance(projectId, str)
        assert isinstance(qdata, dict)

        qbytes = json.dumps(qdata).encode('UTF-8')
        qid = hashlib.sha256(projectId.encode('UTF-8') + qbytes).hexdigest()

        msg = {
            'type': 'broadcast',
            'project': projectId,
            'qid': qid,
            'payload_b64': base64.b64encode(qbytes).decode('ASCII'),
        }
        mbytes = json.dumps(msg).encode('UTF-8')
        for ep in self._all_endpoints():
            ep.send(mbytes)

    def onRecv(self, endpoint, rbytes):
        mobj = json.loads(rbytes.decode('UTF-8'))
        projectId = mobj['project']
        try:
            project = self._projectManager[projectId]
        except KeyError:
            return # Ignore message

        if mobj['type'] == 'query': # We're answering a query
            qdata = _decodeFromStr(mobj['payload_b64'])
            qanswer = project.answerQuery(qdata)
            answerStr = _encodeToStr(qanswer)
            msg = {
                'type': 'query-response',
                'project': mobj['project'],
                'qid': mobj['qid'],
                'payload_b64': answerStr
            }
            mbytes = json.dumps(msg).encode('UTF-8')
            endpoint.send(mbytes)
        elif mobj['type'] == 'query-response':
            # Find the corresponding query
            qid = mobj['qid']
            try:
                onAnswer = self._queries[(id(endpoint), qid)]
            except KeyError:
                print('Spurious query-response ' + qid + ' on ' + str(id(endpoint)))
                print('Outstanding: ' + repr(list(self._queries.keys())))
                return
            answer = _decodeFromStr(mobj['payload_b64'])
            onAnswer(endpoint, answer)
        elif mobj['type'] == 'broadcast':
            msg = _decodeFromStr(mobj['payload_b64'])
            project.handleMessage(endpoint, msg)
        else:
            print('Ignoring received message with type ' + repr(mobj['type']))

class VirtualNetCore(AbstractNetCore):
    """ The network core from the perspective of the DTN virtual application """
    def __init__(self, endpoint, projectManager):
        super(VirtualNetCore, self).__init__(projectManager)
        self._endpoint = endpoint

    def project_onLoad(self, project):
        project.handleEndpoint(self._endpoint)

    def _all_endpoints(self):
        return [self._endpoint]
