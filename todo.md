
Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO
All Rights Reserved.


Annotations 
  @GLOBAL @WIP @NEXT @TODO @NOTE @SCHEDULE
  @ALERT @BUG @FIX
  @PRIORITY-1 @PRIORITY-2 @PRIORITY-3 



@PRIORITY-1

  `mirror` alias for `mirror npm`

  `mirror git`
    - git-based version control
      - see the list of version from git tags
      - update to `vX.Y.Z` or `module@vX.Y.Z`
      - set a new git tag
      - change `latest` to point to a different git tag
      - change `lts` to point to a different git tag

  `mirror npm`
    - npm-based version control -- current behavior of `mirror`
      - the current version on package.json
      - update to `vX.Y.Z` or `module@vX.Y.Z`
      - set a new git tag
      - change `latest` to point to a different git tag
      - change `lts` to point to a different git tag

  `--mode=v|modular` for modular versioning
    - modular versioning: `module@vX.Y.Z`
    - monolithic versioning: `vX.Y.Z`
  
  `--module=<module-name>` to specify the module when using modular versioning

@PRIORITY-2







@PRIORITY-3 


github actions
  test on different node, bun and deno versions
  test on linux, windows and mac



