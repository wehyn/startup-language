# Startup Language Examples

This file showcases common `.startup` patterns by category.

## Arithmetic

```startup
BURN revenue ::> 120?
BURN cost ::> 45?
BURN profit ::> revenue --- cost?
BURN growth ::> profit +++ 10?
BURN scaled ::> growth ****** 2?
BURN runway ::> scaled /// 5?
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
