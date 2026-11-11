import { createContext } from 'solid-js'
import type { Scene } from './Scene'

/** The scene a `Canvas` is drawing, for the sprites inside it. */
export const SceneContext = createContext<Scene>()
