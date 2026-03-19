# Startup Language Examples

This file showcases common `.startup` patterns by category.

## Arithmetic

```startup
BURN revenue ::> 120?
BURN cost ::> 45?
BURN venture ::> 10 +++ 5?
BURN profit ::> revenue --- cost?
BURN growth ::> profit +++ 10?
BURN scaled ::> growth ****** 2?
BURN runway ::> scaled /// 5?
PITCH venture?
PITCH runway?
```

## Comparison

```startup
BURN burnRate ::> 900?
BURN threshold ::> 1000?

EQUITY isHot ::> burnRate >>> threshold?
EQUITY isSafe ::> burnRate <<< threshold?
EQUITY isExact ::> burnRate ??? threshold?
EQUITY isDifferent ::> burnRate !!? threshold?

PITCH isHot?
PITCH isSafe?
```

## Logic + Control Flow

```startup
EQUITY funded ::> VESTED?
EQUITY hasRevenue ::> CLIFF?

EQUITY readyToScale ::> funded AND hasRevenue?
EQUITY risky ::> NOT funded?
EQUITY fallbackPlan ::> funded OR hasRevenue?

PIVOT (readyToScale ??? VESTED) [
  PITCH "Scale GTM now"?
]

SPRINT (risky ??? VESTED) [
  PITCH "Reduce burn"?
  risky ::> CLIFF?
]

PITCH readyToScale?
PITCH risky?
```

## Portfolio Output

```startup
PORTFOLIO milestones ::> ["mvp", "beta", "launch"]?
PITCH milestones?
```

## Scope (Global vs Local)

```startup
VIBE companyStage ::> "seed"?
PITCH companyStage?

PIVOT (VESTED ??? VESTED) [
  VIBE companyStage ::> "series-a"?
  VIBE sprintGoal ::> "ship onboarding"?
  PITCH companyStage?
  PITCH sprintGoal?
]

PITCH companyStage?
```

## Object Basics

```startup
CLASS Startup?
VIBE product ::> NEW Startup?
PITCH product?
```

## Alt Assignment Syntax

```startup
BURN age ::> 0?
age ~ 10 + 5.
PITCH age?
```

## Recovery Behavior

```startup
// Phrase-Level Recovery: missing '?' is auto-inserted
BURN quota ::> 10

// Panic Mode Recovery: invalid token is skipped and trace is recorded
BURN clean ::> 5$?
PITCH clean?
```
