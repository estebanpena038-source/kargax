---
name: kargax-debugger
description: Use when debugging KargaX errors, broken UI, failed builds, Supabase issues, billing checkout problems, or runtime bugs.
---

# KargaX Debugger Skill

## Goal

Find root cause quickly and fix with minimum safe change.

## Debug protocol

1. Capture symptom:
   - route
   - user role
   - company/business state
   - plan
   - action
   - expected result
   - actual result
2. Classify:
   - frontend render error
   - API/server error
   - auth/session error
   - Supabase/RLS error
   - billing/checkout error
   - type/build error
   - data inconsistency
3. Search likely files.
4. Form 3 hypotheses ordered by probability.
5. Validate each hypothesis with command/log/code inspection.
6. Apply minimal fix.
7. Add regression check.

## Output format

```markdown
## Symptom
## Most likely cause
## Evidence
## Fix
## Files changed
## How to test
## Prevention
```
