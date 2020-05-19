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
ARG YARN_CACHE_DIR=/usr/local/share/.cache/yarn/
COPY --chown=circleci:circleci .circleci/scripts/deps-install.sh .
RUN --mount=type=cache,target=$YARN_CACHE_DIR ./deps-install.sh
COPY --chown=circleci:circleci development/prepare-conflux-local-netowrk-lite.js ./development/prepare-conflux-local-netowrk-lite.js
COPY --chown=circleci:circleci . .

RUN printf '#!/bin/sh\nexec "$@"\n' > /tmp/entrypoint-prep-deps \
  && chmod +x /tmp/entrypoint-prep-deps \
  && sudo mv /tmp/entrypoint-prep-deps /docker-entrypoint-prep-deps.sh
ENTRYPOINT ["/docker-entrypoint-prep-deps.sh"]

# prep-deps with browser
FROM circleci/node:10.16.3-browsers AS prep-deps-browser
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

# start xvfb automatically to avoid needing to express in circle.yml
ENV DISPLAY :99
RUN printf '#!/bin/sh\nsudo Xvfb :99 -screen 0 1280x1024x24 &\nexec "$@"\n' > /tmp/entrypoint \
  && chmod +x /tmp/entrypoint \
  && sudo mv /tmp/entrypoint /docker-entrypoint.sh

COPY --chown=circleci:circleci --from=prep-deps /home/circleci/portal/ .

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["/bin/sh"]

### Level 2
# test-lint-shellcheck
FROM prep-deps AS shellcheck
RUN sudo apt update && sudo apt install jq shellcheck -y
RUN yarn lint:shellcheck

# prep-build-test
FROM prep-deps-browser AS prep-build-test
RUN yarn build:test

# # prep-build-storybook
# FROM prep-deps AS prep-build-storybook
# RUN yarn storybook:build

# prep-build
FROM prep-deps AS prep-build
RUN yarn dist
RUN find dist/ -type f -exec md5sum {} \; | sort -k 2

# # test-unit
# FROM prep-deps AS test-unit
# RUN yarn test:coverage

# # test-unit-global
# FROM prep-deps AS test-unit-global
# RUN yarn test:unit:global

# # test-lint
# FROM prep-deps AS test-lint
# RUN yarn lint
# RUN yarn verify-locales --quiet

# # test-lint-lockfile
# FROM prep-deps AS test-lint-lockfile
# RUN yarn lint:lockfile

# prep-scss
FROM prep-deps-browser AS prep-scss
RUN find ui/app/css -type f -exec md5sum {} \; | sort -k 2 > scss_checksum
RUN yarn test:integration:build && yarn test:flat:build
# start xvfb automatically to avoid needing to express in circle.yml
ENV DISPLAY :99
RUN printf '#!/bin/sh\nsudo Xvfb :99 -screen 0 1280x1024x24 &\nexec "$@"\n' > /tmp/entrypoint \
  && chmod +x /tmp/entrypoint \
  && sudo mv /tmp/entrypoint /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["/bin/sh"]


### Level 3
# # test-integration-flat
# FROM prep-scss AS test-flat
# RUN yarn run karma start test/flat.conf.js

# # test-integration-flat-firefox
# FROM prep-scss AS test-flat-firefox
# RUN yarn test:flat

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
