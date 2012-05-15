from .projects import _ProjectHandler
import json

class _ConoProjectHandler(_ProjectHandler):
    def init(self, projectId):
        super(_ConoProjectHandler, self).init(projectId)
        assert self.p.ptype == 'cono'

class ProjectCASHandler(_ConoProjectHandler):
    def get(self, projectId):
        self.init(projectId)

        dct = self.pdict
        cas = self.p.ui_cas
        dct['cas_blocks'] = [{
            'blockId': a,
            'blockId_short': a[:8],
            'contentText': cas[a].decode('UTF-8'),
            } for a in cas]
        dct['template'] = 'project_cas_show'
        dct['title'] = self.p.name + ' - CAS'
        self.render(dct)

class ConoProjectShowHandler(_ConoProjectHandler):
    def get(self, projectId):
        self.init(projectId)

        dct = self.pdict
        dct['template'] = 'project_cono_show'
        dct['title'] = self.p.name
        dct['proposals'] = list(self.p.view_newest(lambda e: e['type'] == 'proposal'))
        self.render(dct)

class ConoProposalHandler(_ConoProjectHandler):
    def get(self, projectId, proposalId, revId=None): # Show one specific proposal
        self.init(projectId)

        proposal = self.p.getEntry(proposalId, revId, includeRevisionIds=True).copy()
        if len(proposal['_revisionIds']) > 1:
            proposal['_revisions_str'] = str(len(proposal['_revisionIds'])) + ' revisions'
        proposal['_revisions_json'] = json.dumps(proposal['_revisionIds'])

        dct = self.pdict
        dct['proposal'] = proposal
        dct['comments'] = list(self.p.view_newest(lambda e: e['type'] == 'comment' and e['proposalId'] == proposalId))
        dct['template'] = 'project_cono_proposal'
        dct['title'] = proposal['title'] + (' (newest revision)' if revId is None else ' (revision ' + revId + ')')
        self.render(dct)

    def post(self, projectId, proposalId=None): # Proposal editing/creation
        self.init(projectId)

        title = self.get_argument('title', None)
        assert title
        description = self.get_argument('description', None)
        assert description

        proposalData = {
            'type': 'proposal',
            'title': title,
            'description': description
        }
        if proposalId:
            proposalData['_id'] = proposalId

        proposal = self.p.local_add(proposalData)

        dct = self.pdict
        dct['proposal_url'] = '/p/' + self.p.idstr + '/' + proposal['_id'] + '/'
        dct['proposal_rev'] = proposal['_rev']
        self.write(dct)

class ConoCommentHandler(_ConoProjectHandler):
    def post(self, projectId, proposalId):
        self.init(projectId)

        text = self.get_argument('text', None)
        assert text
        commentData = {
            'type': 'comment',
            'text': text,
            'proposalId': proposalId,
            'time': time.time()
        }
        self.p.local_add(commentData)


class ProjectDocumentDBHandler(_ConoProjectHandler):
    def get(self, projectId):
        self.init(projectId)

        def _formatDocDBEntry(e):
            simplifiedDict = {k:v for k,v in e.items() if not k.startswith('_')}
            return {
                'id': e['_id'],
                'id_short': e['_id'][:8],
                'rev': e['_rev'],
                'allrevs_str': str(len(e['_all_revisions'])) + ' revisions' if len(e['_all_revisions']) > 1 else '',
                'data_str': json.dumps(simplifiedDict, indent=4, sort_keys=True)
            }

        dct = self.pdict
        dct['docdb'] = list(map(_formatDocDBEntry, self.p.allNewest()))
        dct['template'] = 'project_docdb'
        dct['title'] = self.p.name + ' - docdb'
        self.render(dct)

def routes(prefix):
    return [
        (prefix + r"/", ConoProjectShowHandler),
        (prefix + r"/cas/", ProjectCASHandler),
        (prefix + r"/docdb/", ProjectDocumentDBHandler),
        (prefix + r"/([0-9a-f]+)/", ConoProposalHandler),
        (prefix + r"/([0-9a-f]+)/rev_([0-9a-f]+)/", ConoProposalHandler),
        (prefix + r"/([0-9a-f]+)/submitComment", ConoCommentHandler),
        (prefix + r"/submitProposal", ConoProposalHandler),
    ]

