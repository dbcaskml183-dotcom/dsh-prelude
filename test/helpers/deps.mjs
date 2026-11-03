import {createRequire} from 'node:module';
export const sdkRequire=createRequire(process.env.DSH_TEST_SDK_PACKAGE||new URL('../../package.json',import.meta.url));
export const buildRequire=createRequire(process.env.DSH_COACH_BUILD_PACKAGE||new URL('../../package.json',import.meta.url));
