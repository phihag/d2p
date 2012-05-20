
from .templating import TemplatingHandler
import d2p.core.bootstrap

class DTNHandler(TemplatingHandler):
    def get(self): # List all DTN transports
        dtnTransport = self.application.netCore.ui_dtnTransport

        dct = {
            'template': 'dtn_list',
            'title': 'DTN endpoints',
            'scripts': [{'src': '/static/transport-dtn.js'}],
        }
        dct['dtn_endpoints'] = list(dtnTransport.ui_listEndpointInfo())
        self.render(dct)

class DTNEndpointHandler(TemplatingHandler):
    def get(self, endpointId, action):
        if action != '':
            self.send_error(404)
            return

        def _genProjectInfo(p):
            return {
                'id': p.idstr,
                'name': p.name,
                'locallyAvailable': self.application.project_manager.available(p.idstr)
            }

        # Show a list of projects of this endpoint
        dtnTransport = self.application.netCore.ui_dtnTransport
        ep = dtnTransport.ui_getEndpoint(endpointId)
        epProjects = ep.ui_projects

        projects = list(self.application.project_manager.values())
        endpoint_projectsInfo = list(map(_genProjectInfo, epProjects.values()))
        unadded_projectsInfo = [_genProjectInfo(p) for p in projects if p.idstr not in epProjects]

        epInfo = ep.ui_info
        dct = {
            'dtn_endpoints': [epInfo],
            'template': 'dtn_endpoint',
            'unadded_projects': unadded_projectsInfo,
            'endpoint_projects': endpoint_projectsInfo,
            'title': epInfo['name'] + ' (' + epInfo['os_id'] + ') - DTN endpoint',
            'scripts': [{'src': '/static/transport-dtn.js'}],
        }
        self.render(dct)

    def post(self, endpointId, action):
        dtnTransport = self.application.netCore.ui_dtnTransport
        if action == 'enable':
            dtnTransport.ui_enable(endpointId)
            self.write({'_status': 'enabled'})
        elif action == 'disable':
            dtnTransport.ui_disable(endpointId)
            self.write({'_status': 'disabled'})
        elif action == 'addProject':
            projectId = self.get_argument('projectId', None)
            assert projectId
            project = self.application.project_manager[projectId]
            dtnTransport.ui_getEndpoint(endpointId).ui_addProject(project)
            self.write({'_status': 'added'})
        elif action == 'importProject':
            projectId = self.get_argument('projectId', None)
            assert projectId
            vproject = dtnTransport.ui_getEndpoint(endpointId).ui_projects[projectId]
            project = vproject.makeRProject(self.application.project_manager.ui_parentDir())
            self.application.project_manager.add(project)
            self.write({
                'projectUrl': '/p/' + project.idstr + '/'
            })
        else:
            self.send_error(404)

class P2PHandler(TemplatingHandler):
    def get(self): # List all P2P endpoints and bootstraps
        p2pTransport = self.application.netCore.ui_p2pTransport()
        bootstraps = [{
            'id': bs.assignedId,
            'name': bs.ui_bootstrap_name,
            'type': bs.bootstrap_type,
            'entries': [{
                'transportId': e.transportId,
                'addr': e.addr,
                'port': e.port,
            } for e in bs.ui_entries]
        } for bs in p2pTransport.ui_bootstraps]
        endpoints = [{
            'localPort': ep.ui_localPort,
            'remoteAddr': ep.ui_remoteAddrStr,
        } for ep in p2pTransport.endpoints]

        dct = {
            'bootstraps': bootstraps,
            'endpoints': endpoints,
            'serverPort': p2pTransport.ui_serverPort,
            'title': 'P2P transport',
            'template': 'p2p_overview',
            'scripts': [{'src': '/static/transport-p2p.js'}]
        }
        self.render(dct)

class P2PBootstrapHandler(TemplatingHandler): # Add and configure bootstraps
    def post(self):
        p2pTransport = self.application.netCore.ui_p2pTransport()

        bsType = self.get_argument('bsType', None)
        assert bsType
        bs = d2p.core.bootstrap.create({'bsType': bsType})

        p2pTransport.ui_addBootstrap(bs)

        self.write({'_status': 'added'})

class P2PManualBootstrapHandler(TemplatingHandler): # Add and configure a manual bootstrap
    def post(self, bsId, entry=None):
        assert bsId
        bsId = int(bsId)
        p2pTransport = self.application.netCore.ui_p2pTransport()
        bs = next(bs for bs in p2pTransport.ui_bootstraps if bs.assignedId == bsId)
        assert bs.bootstrap_type == 'manual'

        args = [self.get_argument('transportId'), self.get_argument('addr'), int(self.get_argument('port'))]
        assert all(args)
        bse = d2p.core.bootstrap.BootstrapEntry(*args)

        bs.ui_addEntry(bse)
        self.write({'_status': added})

