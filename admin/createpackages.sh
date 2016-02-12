plat="Darwin"

pkg_plats=("Darwin" "Linux")
pkg_ver=$(cat vsoxplat/package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')
for plat in ${pkg_plats[@]}
do
    pkg_label="xplat${pkg_ver}${plat}64"
    rm -rf "$pkg_label"
    rm "${pkg_label}.tar.gz"

    mkdir "$pkg_label" 
    pushd "$pkg_label"
    ../package.sh "$plat"

    # clean up artifact of acquisition
    rm -rf _install
    rm -rf bin
    rm -rf test
    rm -rf getagent.sh
    rm node-v*.tar.gz
    rm -rf node-v*
    rm TEE-CLC*.zip
    rm -rf TEE-CLC*
    popd

    echo "Creating ${pkg_label}.tar.gz"
    tar -cf ${pkg_label}.tar.gz ${pkg_label}/
done
