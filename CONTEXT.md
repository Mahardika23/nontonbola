# nontonbola

A viewer for the FIFA World Cup 2026 knockout stage: a circular bracket you can explore, hover,
and drill into for team detail. This glossary pins the project's language — the words we use in
code, UI copy, and conversation — so they don't drift.

## Language

**Bracket**:
The full single-elimination tree from the Round of 32 to the Final. There is exactly one, and
its structure is fixed (no redraws).
_Avoid_: draw, tree, ladder

**Round**:
One stage of the bracket: Round of 32, Round of 16, Quarter-final, Semi-final, Final. Each Round
is drawn as one ring of the sunburst.
_Avoid_: stage, leg

**Match**:
A single knockout fixture between two Teams, decided in one game (extra time then penalties if
level after 90'). In this tournament a knockout matchup is always one Match — never two legs.
_Avoid_: tie, fixture, game

**Slot**:
A position in the Bracket that holds either a known Team or an unresolved placeholder ("Winner
of Match 73"). Slots fill in as the tournament progresses.
_Avoid_: seed, spot, position

**Team**:
A national team competing in the tournament, identified by its country.
_Avoid_: nation, country, side, squad

**Journey**:
A Team's path through THIS tournament — the ordered list of matches they have played (group
stage + knockout), each with score and lineup. The "how they got here" story.
_Avoid_: run, path, campaign

**Form**:
A Team's recent results across their last N internationals (W-D-L), independent of this
tournament. The "how hot are they right now" signal.
_Avoid_: momentum, streak, recent record

**Fun fact**:
A short, synthesized highlight about a Team, derived from stats and head-to-head records (e.g.
"scored in every match this tournament"). Not a raw field from any data source — it is computed.
_Avoid_: trivia, stat, note
