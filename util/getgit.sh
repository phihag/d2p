#!/bin/sh

set -e

if [ "$#" -ne 2 ]; then
	echo "Usage: $0 git-url local-dir" >&2
	exit 1
fi

gitUrl="$1"
localDir="$2"

if [ -e "$localDir" ]; then
	cd "$localDir" && git pull
else
	git clone "$gitUrl" "$localDir"
fi
