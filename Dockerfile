# syntax=docker/dockerfile:experimental
### Level 1
# base
FROM circleci/node:10.16.3 AS base
RUN sudo apt update && sudo apt install lsof -y
WORKDIR /home/circleci/portal
COPY --chown=circleci:circleci yarn.lock package.json .

# audit
FROM base AS audit-deps
COPY --chown=circleci:circleci .circleci/scripts/yarn-audit .
RUN ./yarn-audit

# prep-deps without browser
FROM base as prep-deps
COPY --chown=circleci:circleci .circleci/scripts/deps-install.sh .
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn ./deps-install.sh

# prep-deps-with-files without browser
FROM prep-deps as prep-deps-with-files
COPY --chown=circleci:circleci ./development/prepare-conflux-local-netowrk-lite.js ./development/
RUN yarn test:prepare-conflux-local
COPY --chown=circleci:circleci . .

RUN printf '#!/bin/sh\nexec "$@"\n' > /tmp/entrypoint-prep-deps \
  && chmod +x /tmp/entrypoint-prep-deps \
  && sudo mv /tmp/entrypoint-prep-deps /docker-entrypoint-prep-deps.sh
ENTRYPOINT ["/docker-entrypoint-prep-deps.sh"]

# prep-deps with browser
FROM circleci/node:10.16.3-browsers AS prep-deps-browser
# start xvfb automatically to avoid needing to express in circle.yml
ENV DISPLAY :99
RUN printf '#!/bin/sh\nsudo Xvfb :99 -screen 0 1280x1024x24 &\nexec "$@"\n' > /tmp/entrypoint \
  && chmod +x /tmp/entrypoint \
  && sudo mv /tmp/entrypoint /docker-entrypoint.sh

ARG BUILDKITE
ARG BUILDKITE_ARTIFACT_PATHS
ARG BUILDKITE_BRANCH
ARG BUILDKITE_COMMAND
ARG BUILDKITE_LABEL
ARG BUILDKITE_ORGANIZATION_SLUG
ARG BUILDKITE_PARALLEL_JOB
ARG BUILDKITE_PARALLEL_JOB_COUNT
ARG BUILDKITE_REPO
ENV BUILDKITE ${BUILDKITE}
ENV BUILDKITE_ARTIFACT_PATHS ${BUILDKITE_ARTIFACT_PATHS}
ENV BUILDKITE_BRANCH ${BUILDKITE_BRANCH}
ENV BUILDKITE_COMMAND ${BUILDKITE_COMMAND}
ENV BUILDKITE_LABEL ${BUILDKITE_LABEL}
ENV BUILDKITE_ORGANIZATION_SLUG ${BUILDKITE_ORGANIZATION_SLUG}
ENV BUILDKITE_PARALLEL_JOB ${BUILDKITE_PARALLEL_JOB}
ENV BUILDKITE_PARALLEL_JOB_COUNT ${BUILDKITE_PARALLEL_JOB_COUNT}
ENV BUILDKITE_REPO ${BUILDKITE_REPO}
RUN sudo apt update && sudo apt install lsof -y
WORKDIR /home/circleci/portal

# install firefox
COPY --chown=circleci:circleci ./.circleci/scripts/firefox-install ./.circleci/scripts/firefox.cfg ./.circleci/scripts/
RUN ./.circleci/scripts/firefox-install

# install chrome
RUN curl --silent --show-error --location --fail --retry 3 --output /tmp/google-chrome-stable_current_amd64.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && (sudo dpkg -i /tmp/google-chrome-stable_current_amd64.deb || sudo apt-get -fy install)  \
    && rm -rf /tmp/google-chrome-stable_current_amd64.deb \
    && sudo sed -i 's|HERE/chrome"|HERE/chrome" --disable-setuid-sandbox --no-sandbox|g' \
        "/opt/google/chrome/google-chrome" \
    && google-chrome --version

RUN CHROME_VERSION="$(google-chrome --version)" \
    && export CHROMEDRIVER_RELEASE="$(echo $CHROME_VERSION | sed 's/^Google Chrome //')" && export CHROMEDRIVER_RELEASE=${CHROMEDRIVER_RELEASE%%.*} \
    && CHROMEDRIVER_VERSION=$(curl --silent --show-error --location --fail --retry 4 --retry-delay 5 http://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROMEDRIVER_RELEASE}) \
    && curl --silent --show-error --location --fail --retry 4 --retry-delay 5 --output /tmp/chromedriver_linux64.zip "http://chromedriver.storage.googleapis.com/$CHROMEDRIVER_VERSION/chromedriver_linux64.zip" \
    && cd /tmp \
    && unzip chromedriver_linux64.zip \
    && rm -rf chromedriver_linux64.zip \
    && sudo mv chromedriver /usr/local/bin/chromedriver \
    && sudo chmod +x /usr/local/bin/chromedriver \
    && chromedriver --version

COPY --chown=circleci:circleci --from=prep-deps /home/circleci/portal/ .

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["/bin/sh"]

FROM prep-deps-browser AS prep-deps-browser-with-files
COPY --chown=circleci:circleci --from=prep-deps-with-files /home/circleci/portal/ .


### Level 2
# test-lint-shellcheck
FROM prep-deps-with-files AS shellcheck
RUN sudo apt update && sudo apt install jq shellcheck -y
RUN yarn lint:shellcheck

# prep-deps-with-prod-file
FROM prep-deps AS prep-deps-with-prod-files
COPY --chown=circleci:circleci gulpfile.js babel.config.js .
COPY --chown=circleci:circleci ui ./ui
COPY --chown=circleci:circleci app ./app

# prep-build-test
FROM prep-deps-browser-with-files AS prep-build-test
RUN yarn build:test

# # prep-build-storybook
FROM prep-deps-with-prod-files AS prep-build-storybook
COPY --chown=circleci:circleci .storybook .
RUN yarn storybook:build

# prep-build
FROM prep-deps-with-prod-files AS prep-build
RUN yarn dist
RUN find dist/ -type f -exec md5sum {} \; | sort -k 2

# test-prep
FROM prep-deps-with-prod-files AS test-prep
COPY --chown=circleci:circleci ./development/prepare-conflux-local-netowrk-lite.js ./development/prepare-conflux-local-netowrk-lite.js
COPY --chown=circleci:circleci ./test/env.js ./test/env.js
COPY --chown=circleci:circleci ./test/helper.js ./test/helper.js
COPY --chown=circleci:circleci ./test/setup.js ./test/setup.js

# test-unit
FROM test-prep AS test-unit
COPY --chown=circleci:circleci test/stub ./test/stub
COPY --chown=circleci:circleci ./test/lib ./test/lib
COPY --chown=circleci:circleci ./test/data ./test/data
COPY --chown=circleci:circleci ./test/unit ./test/unit
RUN yarn test:coverage

# test-unit-global
FROM test-prep AS test-unit-global
COPY --chown=circleci:circleci ./app/scripts/lib/freezeGlobals.js ./app/scripts/lib/freezeGlobals.js
COPY --chown=circleci:circleci ./test/unit-global ./test/unit-global
RUN yarn test:unit:global

# test-lint
FROM prep-deps-with-files AS test-lint
RUN yarn lint
RUN yarn verify-locales --quiet

# test-lint-lockfile
FROM prep-deps AS test-lint-lockfile
RUN yarn lint:lockfile

# prep-scss
FROM prep-deps-browser AS prep-scss
COPY --chown=circleci:circleci gulpfile.js .
COPY --chown=circleci:circleci ./ui/app/css ./ui/app/css
RUN find ui/app/css -type f -exec md5sum {} \; | sort -k 2 > scss_checksum
RUN yarn test:integration:build

### Level 3
# test-integration-flat
FROM prep-scss AS prep-test-flat
COPY --chown=circleci:circleci ./test/lib ./test/lib
COPY --chown=circleci:circleci ./test/flat.conf.js ./test/flat.conf.js
COPY --chown=circleci:circleci ./development/genStates.js ./development/genStates.js
COPY --chown=circleci:circleci ./development/mock-dev.js ./development/mock-dev.js
COPY --chown=circleci:circleci ./test/integration/index.js ./test/integration/index.js
COPY --chown=circleci:circleci ./test/data ./test/data
COPY --chown=circleci:circleci ./development/states ./development/states
COPY --chown=circleci:circleci ./app/_locales ./app/_locales
RUN yarn test:flat:build
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["/bin/sh"]


# test-integration-flat-firefox
FROM prep-test-flat AS test-flat-firefox
ARG BROWSERS='["Chrome"]'
ENV BROWSERS ${BROWSERS}
RUN sudo Xvfb :99 -screen 0 1280x1024x24 & yarn run karma start test/flat.conf.js

# # test-e2e-chrome
# FROM prep-build-test AS e2e-chrome
# RUN yarn test:e2e:chrome

# # test-e2e-firefox
# FROM prep-build-test AS e2e-firefox
# RUN yarn test:e2e:firefox

# # benchmark
# FROM prep-build-test AS benchmark
# RUN yarn benchmark:chrome --out test-artifacts/chrome/benchmark/pageload.json

# # test-mozilla-lint
# FROM prep-build AS test-mozilla-lint
# RUN NODE_OPTIONS=--max_old_space_size=3072 yarn mozilla-lint
