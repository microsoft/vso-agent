
# Use:
# latest in releases/0.x branch
# preview in master
tag_name=$1

if [ "${tag_name}" != "latest" ] && [ "${tag_name}" != "preview" ]; then
    echo "Invalid release name.  Use latest or preview."
    exit 1
fi

# tag current commit as releases

git push origin :refs/tags/${tag_name}
git tag -fa ${tag_name}
# origin master
git push --tags