
all: make-icons download-libs py2

make-icons:
	make -C wui/static/icons makepng

clean-icons:
	make -C wui/static/icons clean

download-libs:
	mkdir -p libs

	./util/getgit.sh git://github.com/phihag/tornado.git libs/tornado
	cd libs/tornado && python3 setup.py build

	./util/getgit.sh git://github.com/phihag/py3stache.git libs/py3stache

	./util/getgit.sh git://github.com/janl/mustache.js.git libs/mustache.js

	./util/getgit.sh git://github.com/phihag/osxh.git libs/osxh

py2: download-py2libs

download-py2libs: download-libs
	cd libs/tornado && python setup.py build

clean-libs:
	rm -rf libs


clean: clean-libs clean-icons

