
import functools
import os
from . import project

def _projectdir(cfg):
    return os.path.join(cfg['_datadir'], 'projects')

class ProjectManager(object):
    """ Manages the lists of available projects. """

    def __init__(self, cfg, netCore):
        self._cfg = cfg
        self._projects = {}
        self._netCore = netCore
        assert netCore is not None
        self._load()

    def __iter__(self):
        return iter(self._projects.values())

    def __len__(self):
        return len(self._projects)

    def __getitem__(self, idstr):
        return self._projects[idstr]

    def values(self):
        return self._projects.values()

    def available(self, idstr):
        return idstr in self._projects

    def add(self, p):
        self._projects[p.idstr] = p
        p.netCore = self._netCore

    def ui_parentDir(self):
        return _projectdir(self._cfg)

    def _load(self):
        pdir = _projectdir(self._cfg)
        for pn in os.listdir(pdir):
            p = project.load(os.path.join(pdir, pn))
            assert pn == p.idstr
            self.add(p)

    def createReal(self, ptype, pname):
        p = project.createReal(self._netCore, _projectdir(self._cfg), ptype, pname)
        return p
