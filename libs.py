
import os.path,sys

_ROOTDIR = os.path.dirname(os.path.abspath(__file__))

def setupLibs():
    sys.path.append(os.path.join(_ROOTDIR, 'libs', 'tornado', 'build', 'lib'))
    sys.path.append(os.path.join(_ROOTDIR, 'libs', 'py3stache'))
