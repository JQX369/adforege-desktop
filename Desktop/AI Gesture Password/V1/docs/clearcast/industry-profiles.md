# Industry Compliance Profiles

Ad-Forge includes 10 pre-configured industry profiles that enable targeted compliance checking against the most relevant BCAP codes and common issues.

## Profile Overview

| Industry | Key BCAP Codes | Required Disclaimers |
|----------|---------------|---------------------|
| Alcohol | 19.1-19.15 | drinkaware.co.uk |
| Gambling | 17.1-17.10 | BeGambleAware.org, 18+, T&Cs apply |
| Food & Supplements | 13.1-13.7, 15.1-15.2 | - |
| Financial Services | 14.1-14.8 | FCA regulated, Capital at risk, Representative APR |
| Automotive | 20.1-20.4 | Professional driver disclaimer, WLTP figures |
| Children's Products | 5.1-5.8 | Age recommendations |
| Cosmetics & Beauty | 12.1-12.3 | Enhanced in post-production |
| Pharmaceutical | 11.1-11.8 | Always read the label, See your doctor |
| Telecoms | 3.1-3.3 | Average speeds, Fair usage policy |
| Environmental/Eco | 9.1-9.5 | - |

---

## Alcohol

**BCAP Codes**: 19.1-19.15

### Detection Keywords
`alcohol`, `beer`, `wine`, `spirits`, `vodka`, `gin`, `whisky`, `rum`, `champagne`, `cocktail`, `drink`, `pub`, `bar`, `brewery`, `distillery`, `ABV`, `units`, `drunk`, `intoxicated`

### High-Risk Areas
- Appeal to under-18s
- Association with social/sexual success
- Encouraging immoderate consumption
- Linking to driving or machinery
- Therapeutic or energising claims
- Featuring people who appear under 25

### Common Issues
- Actors appearing under 25 (must be 25+)
- Implying alcohol enhances mood/performance
- Showing excessive drinking
- Missing Drinkaware URL

### Required Disclaimers
- `drinkaware.co.uk`

---

## Gambling

**BCAP Codes**: 17.1-17.10

### Detection Keywords
`bet`, `betting`, `gamble`, `gambling`, `casino`, `odds`, `bookie`, `wager`, `stake`, `jackpot`, `lottery`, `slots`, `poker`, `roulette`, `sports betting`, `free bet`, `bonus`

### High-Risk Areas
- Appeal to under-18s
- Suggesting gambling can solve problems
- Featuring celebrities/sports stars
- Trivialising gambling
- Peer pressure to gamble
- Missing responsible gambling messaging

### Common Issues
- Missing BeGambleAware.org
- Implying skill where luck is involved
- Portraying urgency unduly
- Using complex T&Cs

### Required Disclaimers
- `BeGambleAware.org`
- `18+`
- `T&Cs apply`

---

## Food & Supplements

**BCAP Codes**: 13.1-13.7, 15.1-15.2

### Detection Keywords
`food`, `nutrition`, `vitamin`, `supplement`, `healthy`, `diet`, `weight loss`, `slimming`, `low fat`, `sugar free`, `organic`, `natural`, `superfood`, `protein`, `calories`

### High-Risk Areas
- Unsubstantiated health claims
- Claims requiring EFSA approval
- Weight loss miracle claims
- HFSS product restrictions
- Misleading 'natural' claims

### Common Issues
- Health claims not on EU register
- Before/after weight loss imagery
- Implying medicinal benefits
- Targeting children with HFSS

### Required Disclaimers
- None standard (claim-dependent)

---

## Financial Services

**BCAP Codes**: 14.1-14.8

### Detection Keywords
`loan`, `credit`, `mortgage`, `APR`, `interest`, `bank`, `invest`, `savings`, `insurance`, `pension`, `ISA`, `debt`, `borrow`, `repayment`, `finance`, `crypto`, `trading`

### High-Risk Areas
- Misleading representative APR
- Hiding risk warnings
- Unclear terms and conditions
- Targeting vulnerable consumers
- Crypto/trading risk warnings

### Common Issues
- APR not prominent enough
- Risk warnings too small/fast
- Capital at risk messaging missing
- Comparison claims unsubstantiated

### Required Disclaimers
- `FCA regulated`
- `Capital at risk` (investments)
- `Representative APR` (credit)

---

## Automotive

**BCAP Codes**: 20.1-20.4

### Detection Keywords
`car`, `vehicle`, `drive`, `driving`, `road`, `speed`, `mph`, `acceleration`, `performance`, `engine`, `fuel`, `electric`, `EV`, `hybrid`, `emissions`, `safety`

### High-Risk Areas
- Encouraging unsafe driving
- Misleading environmental claims
- Glorifying speed
- Showing illegal driving behaviour

### Common Issues
- Showing unsafe driving
- Misleading range/efficiency claims
- Environmental greenwashing
- Missing safety disclaimers for stunts

### Required Disclaimers
- `Professional driver on closed road` (if applicable)
- `WLTP range figures`

---

## Children's Products

**BCAP Codes**: 5.1-5.8

### Detection Keywords
`children`, `kids`, `toys`, `games`, `play`, `school`, `parents`, `family`, `educational`, `learning`, `fun`

### High-Risk Areas
- Exploiting children's credulity
- Pester power encouragement
- Inappropriate content for age
- Unsafe behaviour portrayal
- HFSS food targeting

### Common Issues
- Exaggerating toy capabilities
- Encouraging anti-social behaviour
- Inappropriate influencer content
- Missing age recommendations

### Required Disclaimers
- `Age recommendations where applicable`
- `Batteries not included` (if applicable)

---

## Cosmetics & Beauty

**BCAP Codes**: 12.1-12.3

### Detection Keywords
`beauty`, `cosmetic`, `skin`, `skincare`, `makeup`, `anti-aging`, `wrinkles`, `moisturiser`, `serum`, `hair`, `shampoo`, `perfume`, `fragrance`, `clinically proven`

### High-Risk Areas
- Medicinal claims (requires license)
- Digitally enhanced imagery
- Unsubstantiated efficacy claims
- Misleading 'clinical' claims

### Common Issues
- Before/after digitally altered
- Medicinal claims without evidence
- Exaggerated transformation claims
- Missing 'results may vary'

### Required Disclaimers
- `Enhanced in post-production` (if digitally altered)

---

## Pharmaceutical & Healthcare

**BCAP Codes**: 11.1-11.8

### Detection Keywords
`medicine`, `drug`, `treatment`, `cure`, `remedy`, `symptom`, `disease`, `illness`, `pain relief`, `pharmacy`, `prescription`, `over the counter`, `OTC`

### High-Risk Areas
- Claims requiring medical evidence
- Targeting children inappropriately
- Encouraging self-diagnosis
- Prescription-only products

### Common Issues
- Unsubstantiated efficacy claims
- Missing 'always read the label'
- Inappropriate celebrity endorsement
- Suggesting rapid/guaranteed results

### Required Disclaimers
- `Always read the label`
- `Contains [active ingredient]`
- `If symptoms persist, see your doctor`

---

## Telecoms & Broadband

**BCAP Codes**: 3.1-3.3

### Detection Keywords
`broadband`, `wifi`, `internet`, `mobile`, `5G`, `4G`, `data`, `unlimited`, `speed`, `Mbps`, `download`, `coverage`, `signal`, `contract`, `SIM`

### High-Risk Areas
- Misleading speed claims
- Coverage exaggeration
- 'Unlimited' with fair use limits
- Hidden costs in contracts

### Common Issues
- Average speed vs headline speed
- Geographic coverage limitations
- Contract terms not prominent
- Price increases hidden

### Required Disclaimers
- `Average speeds`
- `Fair usage policy applies`

---

## Environmental/Eco Claims

**BCAP Codes**: 9.1-9.5

### Detection Keywords
`eco`, `green`, `sustainable`, `carbon neutral`, `net zero`, `recyclable`, `recycled`, `biodegradable`, `plastic free`, `organic`, `natural`, `environment`, `climate`

### High-Risk Areas
- Greenwashing
- Unsubstantiated eco claims
- Misleading 'carbon neutral'
- Partial lifecycle claims

### Common Issues
- Claims applying to packaging not product
- Missing evidence for environmental benefit
- Vague 'eco-friendly' claims
- Carbon offset vs actual reduction

### Required Disclaimers
- None standard (claim-dependent)

---

## Usage in Code

```python
from app.features.clearcast.clearcast_rules import (
    INDUSTRY_PROFILES,
    detect_industry,
    get_profile,
    get_high_risk_summary
)

# Auto-detect from content
industries = detect_industry(
    script_text="Win big with our latest casino games! 18+. BeGambleAware.org"
)
# Returns: ["gambling"]

# Get profile details
profile = get_profile("gambling")
print(profile.high_risk_areas)
print(profile.required_disclaimers)

# Generate prompt context
summary = get_high_risk_summary(industries)
```

## Source File

Implementation: `src/app/features/clearcast/clearcast_rules.py`








