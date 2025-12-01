# BCAP Code Reference

The Broadcast Committee of Advertising Practice (BCAP) Code governs TV advertising in the UK. This document lists the code sections relevant to Ad-Forge's compliance checking.

## Code Sections Used

### General Principles

| Code | Section | Focus Area |
|------|---------|------------|
| BCAP 3.x | Misleading Advertising | Truthfulness, substantiation, comparisons |
| BCAP 5.x | Children | Protecting minors, pester power, HFSS |
| BCAP 9.x | Environmental Claims | Sustainability, eco-claims, greenwashing |

### Industry-Specific

| Code | Section | Focus Area |
|------|---------|------------|
| BCAP 11.x | Medicines & Treatments | Healthcare claims, OTC products |
| BCAP 12.x | Cosmetics | Beauty claims, digital enhancement |
| BCAP 13.x | Food Claims | Nutrition, health claims, HFSS |
| BCAP 14.x | Financial Services | APR, risk warnings, FCA compliance |
| BCAP 15.x | Supplements | Vitamins, dietary supplements |
| BCAP 17.x | Gambling | Responsible gambling, age restrictions |
| BCAP 19.x | Alcohol | Age appearance, moderation messaging |
| BCAP 20.x | Motoring | Safe driving, environmental claims |

## Full Code Mapping by Industry

### Alcohol (BCAP 19.x)
```
BCAP 19.1  - Alcohol advertising general principles
BCAP 19.2  - Responsibility and moderation
BCAP 19.3  - People in alcohol ads (age 25+ appearance)
BCAP 19.4  - Social success association
BCAP 19.5  - Sexual success association
BCAP 19.6  - Dangerous or anti-social behaviour
BCAP 19.7  - Sporting/physical prowess
BCAP 19.8  - Driving and machinery
BCAP 19.9  - Therapeutic or enhancement claims
BCAP 19.10 - Strength or intoxicating effect
BCAP 19.11 - Challenge or competition
BCAP 19.12 - Excessive consumption
BCAP 19.13 - Low alcohol alternatives
BCAP 19.14 - Appeal to under-18s
BCAP 19.15 - Scheduling restrictions
```

### Gambling (BCAP 17.x)
```
BCAP 17.1  - General gambling principles
BCAP 17.2  - Social responsibility
BCAP 17.3  - Appeal to under-18s
BCAP 17.4  - People in gambling ads
BCAP 17.5  - Skill vs luck portrayal
BCAP 17.6  - Urgency and pressure
BCAP 17.7  - Problem gambling
BCAP 17.8  - Celebrity/sports star endorsement
BCAP 17.9  - Promotional offers
BCAP 17.10 - Required messaging (BeGambleAware)
```

### Financial Services (BCAP 14.x)
```
BCAP 14.1  - General principles
BCAP 14.2  - Credit and loans (APR requirements)
BCAP 14.3  - Investments and savings
BCAP 14.4  - Insurance products
BCAP 14.5  - Pensions
BCAP 14.6  - Cryptocurrency and trading
BCAP 14.7  - Comparison claims
BCAP 14.8  - Vulnerable consumers
```

### Food & Supplements (BCAP 13.x, 15.x)
```
BCAP 13.1  - General food principles
BCAP 13.2  - Health claims (EFSA register)
BCAP 13.3  - Nutrition claims
BCAP 13.4  - Weight management
BCAP 13.5  - Children and HFSS
BCAP 13.6  - Promotional offers
BCAP 13.7  - Functional foods

BCAP 15.1  - Supplements general
BCAP 15.2  - Vitamins and minerals claims
```

### Pharmaceuticals (BCAP 11.x)
```
BCAP 11.1  - General medicines principles
BCAP 11.2  - Licensed medicines only
BCAP 11.3  - OTC medicines
BCAP 11.4  - Prescription-only (prohibited)
BCAP 11.5  - Claims substantiation
BCAP 11.6  - Celebrity endorsement
BCAP 11.7  - Children's medicines
BCAP 11.8  - Required disclaimers
```

### Children's Products (BCAP 5.x)
```
BCAP 5.1  - General protection principles
BCAP 5.2  - Credulity and inexperience
BCAP 5.3  - Pester power
BCAP 5.4  - Safety and behaviour
BCAP 5.5  - Direct exhortation
BCAP 5.6  - Price and value
BCAP 5.7  - HFSS restrictions
BCAP 5.8  - Scheduling restrictions
```

### Environmental Claims (BCAP 9.x)
```
BCAP 9.1  - Truthfulness of eco claims
BCAP 9.2  - Substantiation requirements
BCAP 9.3  - Lifecycle considerations
BCAP 9.4  - Carbon/net-zero claims
BCAP 9.5  - Recyclability claims
```

### Automotive (BCAP 20.x)
```
BCAP 20.1  - Safe driving depiction
BCAP 20.2  - Speed and performance
BCAP 20.3  - Environmental claims (emissions, EV range)
BCAP 20.4  - Professional driver disclaimers
```

### Cosmetics (BCAP 12.x)
```
BCAP 12.1  - General principles
BCAP 12.2  - Efficacy claims
BCAP 12.3  - Digital enhancement disclosure
```

### Telecoms (BCAP 3.x - Misleading)
```
BCAP 3.1  - Truthful claims
BCAP 3.2  - Speed and coverage claims
BCAP 3.3  - Contract terms prominence
```

## How Codes Are Applied

1. **Auto-Detection**: Industry keywords trigger relevant code sections
2. **Prompt Injection**: Relevant BCAP codes are injected into AI prompts
3. **Flag Attribution**: Each compliance flag cites the applicable BCAP code
4. **Severity Mapping**: Code violations map to red/amber/blue flag severity

## Source Reference

Implementation: `src/app/features/clearcast/clearcast_rules.py`

```python
from app.features.clearcast.clearcast_rules import (
    get_relevant_bcap_codes,
    detect_industry
)

industries = detect_industry(script_text="Enjoy responsibly. Drinkaware.co.uk")
codes = get_relevant_bcap_codes(industries)  # Returns BCAP 19.x codes
```








