# Learn behavior

Learn follows Quizlet’s publicly documented study flow, using a rule-based approximation. It does not reproduce Quizlet’s proprietary trained model or AI grading. No comparative learning-effectiveness claim has been tested.

Sources checked November 3, 2026:

- [Current Learn help](https://help.quizlet.com/hc/en-us/articles/360030986971-Studying-with-Learn): goals, initial familiarity, starred terms, direction, grading and correction settings.
- [How Quizlet works](https://quizlet.com/features/how-quizlet-works): retrieval practice and the progression from choices to written recall.
- [Quizlet’s historical technical explanation](https://quizlet.com/blog/spaced-repetition-for-all-cognitive-science-meets-big-data-in-a-procrastinating-world): predicted recall and prioritization, based on correctness, elapsed time, prior answer spacing and direction. This historical article does not establish the current model’s implementation or weights.

## Index implementation

Each card stores separate Learn history for term and definition answers inside the existing per-account progress record. Changing card content invalidates that card’s Learn history. Flashcards and Review preserve it; Reset progress clears it. Stars remain separate from progress.

Rounds contain up to seven distinct cards. The scheduler ranks practiced cards by an estimated recall score, mixing up to two practiced cards with one new card while filling a round. Misses reduce estimated stability and reset correct streaks. Correct recognition leads to written recall, and a missed written answer stays in written practice instead of reverting to multiple choice. Written-attempt counts and earlier correct-answer history preserve that transition across visits. Answers recur in later rounds rather than receiving credit through immediate retries. Successful recalls after longer intervals increase estimated stability more than immediate recalls. Older completed material becomes eligible again as its estimated recall falls.

Three goal thresholds are Index’s own design choices, not published Quizlet thresholds:

- Basic familiarity: two correct answers in separate rounds, using multiple choice where distinct options exist.
- Solid understanding: two consecutive written recalls, across separate rounds.
- Complete mastery: three consecutive written recalls, with stricter spelling.

“Most of it” starts unseen material with written questions. “Some of it” uses existing successful study progress to choose a starting difficulty. Actual Learn history takes precedence over either self-assessment. A missed written answer can require retyping; copying the correction earns no additional recall credit. “I was right” replaces the last outcome rather than counting both a miss and a success.

Completion means the selected practice target was reached for that direction, not a guarantee of durable mastery. Reaching a target schedules spaced Review. Smart grading adds conservative local rules for common English synonyms, inflections, passive voice, list order and simple numeric equivalents. It checks numbers, negation and subject/object direction to reject several common false matches. It is not a general semantic model: unfamiliar paraphrases can still be marked wrong, and plausible wording is not a factual guarantee. “I was right” remains available in Learn. Standard grading can be selected in Learn/Test; Complete mastery always requires strict spelling. The retention coefficients are heuristics and have not been fitted to learner outcome data.

Stars sync as private, per-account rows in `study_stars`. They work on owned or accessible shared sets and do not change the set for other learners. Flashcards and Learn support starred-only practice.
