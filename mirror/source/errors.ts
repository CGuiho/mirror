/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

export class MirrorError extends Error {
  readonly exitCode: number

  constructor(message: string, exitCode = 1) {
    super(message)
    this.name = 'MirrorError'
    this.exitCode = exitCode
  }
}

export class MirrorUsageError extends MirrorError {
  readonly helpPath: readonly string[]

  constructor(message: string, helpPath: readonly string[]) {
    super(message)
    this.name = 'MirrorUsageError'
    this.helpPath = helpPath
  }
}

export const invariant = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new MirrorError(message)
}
