# Shakespeare ↔ NYC Neighborhood Matcher

Every Shakespeare play matched to the New York City neighborhood whose physical features,
character, and business mix best fit the play's setting, themes, and mood. Plays and all
262 NYC Neighborhood Tabulation Areas are scored on one 6-axis codebook
(water & coast, green & wild, civic power, commerce, danger & death, festivity & disguise),
then matched by distance and rendered as an interactive five-borough map.

**Live demo:** https://bialikcn-30love.github.io/shakespeare-nyc/

Toggle *Nearest match ⟷ One-to-one*; deep-link a play with `#play=The%20Tempest`
or a mode with `?mode=distinct`. Built with Leaflet; data from NYC Open Data (NTA, Parks),
US Census TIGER (water), and OpenStreetMap (amenities).
