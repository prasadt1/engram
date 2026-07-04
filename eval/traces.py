"""Scripted multi-session memory traces for the /eval harness.

Each trace is a mini life story with facts that get superseded, so
recall/forgetting can be measured against a known-correct answer key.

FROZEN SET (see eval/README.md for the freeze declaration, date, and the
post-freeze change policy). Do not edit a trace after seeing engine results
to make it pass — a genuinely-revealed engine limitation stays failing and
gets a `# KNOWN-LIMIT:` comment instead of a quiet fix.
"""

from __future__ import annotations
from dataclasses import dataclass


@dataclass
class Fact:
    content: str
    genre: str | None
    valid_from_session: int
    invalidated_by_session: int | None = None  # None = still valid


@dataclass
class Trace:
    user_id: str
    facts: list[Fact]
    query: str
    expects_current: list[str]   # substrings that SHOULD appear among recalled content
    expects_absent: list[str]    # substrings that should NOT appear (superseded facts)


TRACES: list[Trace] = [
    # ------------------------------------------------------------------
    # Original seed traces (kept verbatim; ids preserved so historical
    # results.json diffs stay meaningful across the expansion).
    # ------------------------------------------------------------------
    Trace(
        user_id="trace_1",
        facts=[
            Fact("shoots primarily with a Canon body", "gear", valid_from_session=1, invalidated_by_session=3),
            Fact("switched to a Sony mirrorless body", "gear", valid_from_session=3),
        ],
        query="What camera gear do I use?",
        expects_current=["Sony"],
        expects_absent=["Canon"],
    ),
    Trace(
        user_id="trace_2",
        facts=[
            Fact("struggles with tilted horizons in landscape shots", "landscape", valid_from_session=1, invalidated_by_session=4),
            Fact("consistently level horizons across recent landscape sessions", "landscape", valid_from_session=4),
        ],
        query="Do I still need to work on horizon tilt in my landscapes?",
        expects_current=["level horizons"],
        expects_absent=["struggles with tilted"],
    ),
    Trace(
        user_id="trace_3",
        facts=[
            Fact("prefers moody low-key portrait lighting", "portrait", valid_from_session=2),
            Fact("wants to improve environmental portrait composition", "portrait", valid_from_session=5),
        ],
        query="What am I working on in my portraits?",
        expects_current=["environmental portrait composition"],
        expects_absent=[],
        # control: nothing superseded here — both facts are still live. Keeps
        # FAMA honest by including traces where forgetting plays no role.
    ),
    Trace(
        user_id="trace_adversarial_1",
        facts=[
            Fact("prefers shooting landscapes at midday", "landscape", valid_from_session=6, invalidated_by_session=7),
            Fact("switched to golden-hour landscape sessions", "landscape", valid_from_session=7),
        ],
        query="When do I like to shoot landscapes?",
        expects_current=["golden"],
        expects_absent=["midday"],
    ),
    # ^ adversarial: the obsolete "midday" fact is nearly as RECENT as its
    # correction — naive recency ranking surfaces it; only supersession-aware
    # recall reliably excludes it.

    # ------------------------------------------------------------------
    # Adversarial recent-but-obsolete (>=6 total; 5 more added here to join
    # trace_adversarial_1). Each pair is superseded one session apart — the
    # hardest case for a recency-only ranker, and the class that separates
    # the engine from the no-forgetting ablation.
    # ------------------------------------------------------------------
    Trace(
        user_id="trace_adversarial_2",
        facts=[
            Fact("lights portraits with available window light only", "portrait", valid_from_session=8, invalidated_by_session=9),
            Fact("moved to studio strobes for portrait sessions", "portrait", valid_from_session=9),
        ],
        query="How do I light my portraits these days?",
        expects_current=["studio strobes"],
        expects_absent=["window light only"],
    ),
    Trace(
        user_id="trace_adversarial_3",
        facts=[
            Fact("shoots wildlife handheld with the long lens", "wildlife", valid_from_session=8, invalidated_by_session=9),
            Fact("now shoots wildlife on a tripod with a gimbal head", "wildlife", valid_from_session=9),
        ],
        query="What's my current wildlife shooting setup?",
        expects_current=["gimbal head"],
        expects_absent=["handheld"],
    ),
    Trace(
        user_id="trace_adversarial_4",
        facts=[
            Fact("edits street photography in full color", "street", valid_from_session=9, invalidated_by_session=10),
            Fact("switched street photography to black-and-white edits", "street", valid_from_session=10),
        ],
        query="Am I editing my street shots in color or black-and-white now?",
        expects_current=["black-and-white"],
        expects_absent=["full color"],
    ),
    Trace(
        user_id="trace_adversarial_5",
        facts=[
            Fact("shoots still life setups next to a window for soft light", "still_life", valid_from_session=7, invalidated_by_session=8),
            Fact("built a softbox lighting setup for still life work", "still_life", valid_from_session=8),
        ],
        query="What lighting setup am I using for still life?",
        expects_current=["softbox"],
        expects_absent=["next to a window"],
    ),
    Trace(
        user_id="trace_adversarial_6",
        facts=[
            Fact("shoots architecture handheld with a wide-angle lens", "architecture", valid_from_session=9, invalidated_by_session=10),
            Fact("switched to a tilt-shift lens to keep architecture verticals straight", "architecture", valid_from_session=10),
        ],
        query="What lens am I using for architecture verticals?",
        expects_current=["tilt-shift"],
        expects_absent=["wide-angle lens"],
    ),

    # ------------------------------------------------------------------
    # Genre coverage (>=3 traces per genre: landscape, portrait, still_life,
    # street, wildlife, architecture). Several genre slots are already
    # satisfied by the adversarial traces above; these fill the remainder
    # so every genre reaches at least 3 traces where the query names or
    # implies that genre.
    # ------------------------------------------------------------------
    Trace(
        user_id="trace_4",
        facts=[
            Fact("blows out skies in bright landscape conditions", "landscape", valid_from_session=2, invalidated_by_session=6),
            Fact("uses graduated ND filters to hold landscape sky detail", "landscape", valid_from_session=6),
        ],
        query="How do I handle bright skies in my landscape shots?",
        expects_current=["graduated ND filters"],
        expects_absent=["blows out skies"],
    ),
    Trace(
        user_id="trace_5",
        facts=[
            Fact("portrait subjects often have missing catchlights in their eyes", "portrait", valid_from_session=3, invalidated_by_session=7),
            Fact("uses a reflector for portrait catchlights now", "portrait", valid_from_session=7),
        ],
        query="Do my portrait subjects still lack catchlights?",
        expects_current=["reflector for portrait catchlights"],
        expects_absent=["missing catchlights"],
    ),
    Trace(
        user_id="trace_6",
        facts=[
            Fact("still life frames end up with cluttered backgrounds", "still_life", valid_from_session=2, invalidated_by_session=5),
            Fact("composes still life with negative space and minimal backgrounds", "still_life", valid_from_session=5),
        ],
        query="What's my approach to still life backgrounds now?",
        expects_current=["negative space"],
        expects_absent=["cluttered backgrounds"],
    ),
    Trace(
        user_id="trace_7",
        facts=[
            Fact("wants to master focus stacking for macro-style still life shots", "still_life", valid_from_session=4),
        ],
        query="What still life technique am I trying to learn?",
        expects_current=["focus stacking"],
        expects_absent=[],
        # control: single still-live fact, nothing superseded.
    ),
    Trace(
        user_id="trace_8",
        facts=[
            Fact("feels hesitant approaching strangers for street photography", "street", valid_from_session=2, invalidated_by_session=6),
            Fact("shoots candid street photography confidently using zone focusing", "street", valid_from_session=6),
        ],
        query="Am I still nervous shooting people on the street?",
        expects_current=["confidently using zone focusing"],
        expects_absent=["hesitant approaching strangers"],
    ),
    Trace(
        user_id="trace_9",
        facts=[
            Fact("mentor called street photography the genre I'm strongest in right now", "street", valid_from_session=8),
        ],
        query="Which genre is my strongest according to my mentor?",
        expects_current=["strongest in right now"],
        expects_absent=[],
    ),
    Trace(
        user_id="trace_10",
        facts=[
            Fact("misses wildlife shots because autofocus hunts on the long lens", "wildlife", valid_from_session=3, invalidated_by_session=7),
            Fact("fixed wildlife autofocus misses with back-button focus and AF-C", "wildlife", valid_from_session=7),
        ],
        query="Did I fix my wildlife autofocus problems?",
        expects_current=["back-button focus and AF-C"],
        expects_absent=["autofocus hunts"],
    ),
    Trace(
        user_id="trace_11",
        facts=[
            Fact("sets a personal rule to keep a respectful distance from wildlife subjects", "wildlife", valid_from_session=5),
        ],
        query="What's my ethics rule for wildlife photography?",
        expects_current=["respectful distance"],
        expects_absent=[],
        # control: single still-live fact, nothing superseded.
    ),
    Trace(
        user_id="trace_12",
        facts=[
            Fact("architecture verticals come out crooked straight out of camera", "architecture", valid_from_session=3, invalidated_by_session=8),
            Fact("corrects architecture verticals with perspective control in post", "architecture", valid_from_session=8),
        ],
        query="Are my architecture verticals still crooked?",
        expects_current=["perspective control in post"],
        expects_absent=["crooked straight out"],
    ),
    Trace(
        user_id="trace_13",
        facts=[
            Fact("chasing symmetry as the signature look of my architecture work", "architecture", valid_from_session=6),
        ],
        query="What's my signature look in architecture photography?",
        expects_current=["chasing symmetry"],
        expects_absent=[],
    ),

    # ------------------------------------------------------------------
    # Preference-supersession chains: A -> B -> C, two supersessions deep.
    # Only C (the current fact) should surface; both A and B are obsolete.
    # ------------------------------------------------------------------
    Trace(
        user_id="trace_chain_1",
        facts=[
            Fact("edits photos with a warm orange-and-teal color grade", "editing", valid_from_session=1, invalidated_by_session=4),
            Fact("moved editing style to a desaturated moody color grade", "editing", valid_from_session=4, invalidated_by_session=8),
            Fact("settled on a natural true-to-life color grade for edits", "editing", valid_from_session=8),
        ],
        query="What's my color grading style right now?",
        expects_current=["natural true-to-life color grade"],
        expects_absent=["orange-and-teal", "desaturated moody"],
    ),
    Trace(
        user_id="trace_chain_2",
        facts=[
            Fact("does all post-processing in Lightroom", "editing", valid_from_session=1, invalidated_by_session=5),
            Fact("switched post-processing over to Capture One", "editing", valid_from_session=5, invalidated_by_session=9),
            Fact("runs a DxO PureRAW plus Lightroom hybrid editing workflow", "editing", valid_from_session=9),
        ],
        query="What software do I use to edit my photos?",
        expects_current=["DxO PureRAW plus Lightroom hybrid"],
        expects_absent=["Capture One", "does all post-processing in Lightroom"],
    ),
    Trace(
        user_id="trace_chain_3",
        facts=[
            Fact("only shoots photography on weekends", "habit", valid_from_session=1, invalidated_by_session=5),
            Fact("added Wednesday evening walks to the weekend shooting routine", "habit", valid_from_session=5, invalidated_by_session=9),
            Fact("shoots every day now with a phone as a backup camera", "habit", valid_from_session=9),
        ],
        query="How often do I actually go shoot?",
        expects_current=["shoots every day now"],
        expects_absent=["only shoots photography on weekends", "Wednesday evening walks"],
    ),

    # ------------------------------------------------------------------
    # Multi-hop / synthesis queries: expects_current lists substrings from
    # DIFFERENT facts within the same trace, so a good recall must surface
    # several items at once, not just the single best match.
    # ------------------------------------------------------------------
    Trace(
        user_id="trace_multihop_1",
        facts=[
            Fact("used to struggle with tilted horizons in landscape work", "landscape", valid_from_session=6, invalidated_by_session=10),
            Fact("cleared the landscape horizon weakness with a hotshoe bubble level", "landscape", valid_from_session=10),
            Fact("used to miss wildlife shots from slow autofocus", "wildlife", valid_from_session=6, invalidated_by_session=10),
            Fact("cleared the wildlife autofocus weakness by switching to back-button focus", "wildlife", valid_from_session=10),
            Fact("still actively working on portrait composition, no breakthrough yet", "portrait", valid_from_session=6),
        ],
        query="What did I improve the most this month?",
        expects_current=["bubble level", "back-button focus"],
        expects_absent=["tilted horizons", "slow autofocus"],
        # multi-hop: the two cleared weaknesses live in different genres
        # (landscape, wildlife) — a correct answer must surface BOTH, and
        # must not let either obsolete predecessor leak back in.
    ),
    Trace(
        user_id="trace_multihop_2",
        facts=[
            Fact("street photography keeper rate is the highest of any genre right now", "street", valid_from_session=9),
            Fact("wildlife keeper rate is climbing but still behind street", "wildlife", valid_from_session=9),
            Fact("landscape work is still developing, lowest keeper rate of the three", "landscape", valid_from_session=9),
        ],
        query="Which genre am I strongest in, and how does it compare to the others?",
        expects_current=["street photography keeper rate is the highest", "wildlife keeper rate is climbing"],
        expects_absent=[],
        # multi-hop: "strongest... compare to others" requires surfacing the
        # leading genre AND at least one runner-up for the comparison to
        # make sense — a single-fact answer would be incomplete.
    ),
    Trace(
        user_id="trace_multihop_3",
        facts=[
            Fact("architecture symmetry work has become consistently sharp and well-composed", "architecture", valid_from_session=9),
            Fact("still life negative-space compositions are getting cleaner every session", "still_life", valid_from_session=9),
            Fact("portrait catchlights are reliably present now thanks to the reflector habit", "portrait", valid_from_session=9),
        ],
        query="Can you summarize my overall progress across genres?",
        expects_current=["architecture symmetry work has become consistently sharp", "negative-space compositions are getting cleaner", "portrait catchlights are reliably present"],
        expects_absent=[],
        # multi-hop: a genre-spanning summary needs all three genre facts
        # surfaced together, not just the single highest-salience one.
    ),
    Trace(
        user_id="trace_multihop_4",
        facts=[
            Fact("switched the main camera body over to a Sony mirrorless", "gear", valid_from_session=9),
            Fact("added a dedicated macro lens for close-up still life work", "gear", valid_from_session=9),
        ],
        query="What gear changes have I made recently?",
        expects_current=["Sony mirrorless", "dedicated macro lens"],
        expects_absent=[],
        # multi-hop: "gear changes" (plural) spans two independent, still-
        # live facts — both must surface for the answer to be complete.
    ),
]
