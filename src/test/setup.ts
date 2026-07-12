import 'fake-indexeddb/auto';
import { createChromeStub } from './chrome-stub';

Object.assign(globalThis, { chrome: createChromeStub() });
