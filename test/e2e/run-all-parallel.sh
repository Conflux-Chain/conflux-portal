#!/usr/bin/env bash

set -x
set -o pipefail

export PATH="$PATH:./node_modules/.bin"

[ "$BUILDKITE_PARALLEL_JOB" = '0' ] && mocha --no-timeouts test/e2e/tests/*.spec.js

[ "$BUILDKITE_PARALLEL_JOB" = '1' ] && concurrently --kill-others \
  --names 'dapp,e2e' \
  --prefix '[{time}][{name}]' \
  --success first \
  'yarn dapp' \
  'mocha test/e2e/metamask-ui.spec'

[ "$BUILDKITE_PARALLEL_JOB" = '2' ] && concurrently --kill-others \
  --names 'dapp,e2e' \
  --prefix '[{time}][{name}]' \
  --success first \
  'yarn dapp' \
  'mocha test/e2e/metamask-responsive-ui.spec'

[ "$BUILDKITE_PARALLEL_JOB" = '3' ] && concurrently --kill-others \
  --names 'dapp,e2e' \
  --prefix '[{time}][{name}]' \
  --success first \
  'yarn dapp' \
  'mocha test/e2e/signature-request.spec'

[ "$BUILDKITE_PARALLEL_JOB" = '4' ] && concurrently --kill-others \
  --names 'e2e' \
  --prefix '[{time}][{name}]' \
  --success first \
  'mocha test/e2e/from-import-ui.spec'

[ "$BUILDKITE_PARALLEL_JOB" = '5' ] && concurrently --kill-others \
  --names 'e2e' \
  --prefix '[{time}][{name}]' \
  --success first \
  'mocha test/e2e/send-edit.spec'

[ "$BUILDKITE_PARALLEL_JOB" = '6' ] && concurrently --kill-others \
  --names 'dapp,e2e' \
  --prefix '[{time}][{name}]' \
  --success first \
  'yarn dapp' \
  'mocha test/e2e/ethereum-on.spec'

[ "$BUILDKITE_PARALLEL_JOB" = '7' ] && concurrently --kill-others \
  --names 'dapp,e2e' \
  --prefix '[{time}][{name}]' \
  --success first \
  'yarn dapp' \
  'mocha test/e2e/permissions.spec'

# concurrently --kill-others \
#   --names 'sendwithprivatedapp,e2e' \
#   --prefix '[{time}][{name}]' \
#   --success first \
#   'yarn sendwithprivatedapp' \
#   'mocha test/e2e/incremental-security.spec'

[ "$BUILDKITE_PARALLEL_JOB" = '8' ] && concurrently --kill-others \
  --names 'dapp,e2e' \
  --prefix '[{time}][{name}]' \
  --success first \
  'yarn dapp' \
  'mocha test/e2e/address-book.spec'

# concurrently --kill-others \
#   --names '3box,dapp,e2e' \
#   --prefix '[{time}][{name}]' \
#   --success first \
#   'node test/e2e/mock-3box/server.js' \
#   'yarn dapp' \
#   'mocha test/e2e/threebox.spec'
