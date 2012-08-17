#!/usr/bin/env python3

# Start d2p

import sys,os.path

_ROOTDIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(_ROOTDIR)
import d2p
sys.path.remove(_ROOTDIR)

d2p.main()
