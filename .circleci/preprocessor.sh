#!/bin/bash
set -e

OUTPUT_FILE=".circleci/config_continue.yml"

# echo "version: 2.1" > "$OUTPUT_FILE"
# echo "" >> "$OUTPUT_FILE"
echo "# Circle CI config split up in modules" >> $OUTPUT_FILE
echo "# https://medium.com/%40philblenk6/circleci-config-splitting-7024bad400e3" >> $OUTPUT_FILE
echo "# https://github.com/blenky36/circleci-config-splitting?source=post_page-----7024bad400e3---------------------------------------" >> $OUTPUT_FILE
# Executors
if [ -f ".circleci/src/@config.yml" ]; then
  cat .circleci/src/@config.yml >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Jobs
echo "jobs:" >> "$OUTPUT_FILE"
for file in $(ls .circleci/src/jobs/*.yml | sort); do
  sed 's/^/  /' "$file" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
done

# Workflows
echo "# Consolidate workflows into a single, filtered workflow" >> "$OUTPUT_FILE"
echo "workflows:" >> "$OUTPUT_FILE"
if [ -f ".circleci/src/workflows/workflow.yml" ]; then
  sed 's/^/  /' ".circleci/src/workflows/workflow.yml" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Validate (optional)
if command -v circleci &> /dev/null; then
  circleci config validate "$OUTPUT_FILE"
fi
