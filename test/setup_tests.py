
import imp
import os.path
import sys

_MODULE_NAME = 'd2p'

_rootDir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_mod = imp.find_module(_MODULE_NAME, [_rootDir])
imp.load_module(_MODULE_NAME, *_mod)

assert _MODULE_NAME in sys.modules


