#!/usr/bin/env python3

import setup_tests
import unittest

import d2p.util

class TestUtil(unittest.TestCase):
    def test_sortkey_natural(self):
        assert d2p.util.sortkey_natural('a') < d2p.util.sortkey_natural('b')
        assert d2p.util.sortkey_natural('a1') < d2p.util.sortkey_natural('a2')
        assert d2p.util.sortkey_natural('a10') > d2p.util.sortkey_natural('a2')
        assert d2p.util.sortkey_natural('a10') < d2p.util.sortkey_natural('a132')
        assert d2p.util.sortkey_natural('a10b9') < d2p.util.sortkey_natural('a10b12')

        assert d2p.util.sortkey_natural('1') < d2p.util.sortkey_natural('a')

if __name__ == '__main__':
    unittest.main()
