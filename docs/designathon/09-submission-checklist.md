# Designathon Submission Checklist (due Tuesday 29 September 2026, 11:59 PM Sri Lanka time)

> **v0.4 data alignment.** The file is built in the team's Figma Education team with all 13 pages, the story follows the v0.4 scenario, and a native-speaker check of the Sinhala and Tamil strings is its own step.

Form: https://forms.gle/H6dqUZP6pXdGC8Go8

## 1. The Figma file
- [x] Built in the team's Figma **Education** team, Team folder: https://www.figma.com/design/xjE8C4PzCMoiNgNI2q8Mn4/Ryzera_Designathon. 13 pages (00 Cover to 12 AI Disclosure), 16 story boards numbered "N of 16". The Relay Builder plugin (`tools/figma-builder/dist/plugin/manifest.json`) can rebuild it into an empty file if ever needed, but a rebuild loses the portraits and every hand edit.
- [x] The four persona portraits are in the "Profile card" on Story / 06 to 09, cropped from `docs/designathon/assests/personas/`. The Canva row on Story / 15 AI tool disclosure and in `07-ai-disclosure.md` stays.
- [x] The one manual touch the API can't do: the DSP-02 Publish dialog's overlay background (#14181F at 40%, close on click outside). Done by hand and tested in the prototype on 2026-09-27.
- [x] The dialog's "Publish plan" lands on DSP-02 Plan board / published (6:40 PM), so the dispatcher flow ends on the published plan instead of a dead button.
- [ ] Cover: set `docs/designathon/assests/cover/cover-panel.jpg` as the fill of "Mark panel" on Story / 01 Cover, hide "Relay mark, large" and "Mark caption", and add the cover photo to the Canva lines on Story / 15 (the same words as `07-ai-disclosure.md`).

## 2. Review the file
- [ ] Each member reviews and edits their own part (see the README Team table), and records the edits in `docs/ai-usage-log.md`.
- [ ] **Native-speaker check.** A native Sinhala speaker reads every Sinhala string and a native Tamil speaker every Tamil string, from `language-check.md` (each string with its English and where it appears, including Kasun's and Rizwan's persona quotes). Write the better wording in the last column; each change goes into the Figma file and the step file. Kasun's quote is done: Kalana's own wording went into the file on 27 Sep.
- [ ] If any number or time changed during review, change it in `05-scenario-data.md` first and run `python tools/data-check/validate_scenario.py` (about six minutes; `--quick` skips the long searches). It must end with PASSED.
- [ ] Play each prototype flow once, from its starting point.

## 3. Prototype link
- [ ] Share, Anyone with the link, Can view. Copy the prototype link (Present, then Share prototype).
- [ ] Open the link in a private browser window to confirm it works without login.

## 4. Demo video (3 to 5 minutes)
- [ ] Record from `docs/designathon/08-demo-video-script.md`, in your own words.
- [ ] Upload to YouTube as **Unlisted**. Check the link in a private window.

## 5. Export and zip
- [ ] File, Save local copy, saved as `Ryzera_Designathon.fig`.
- [ ] Also export a PDF of the Story boards and the screens (select all top-level frames, Export as PDF), saved as `Ryzera_Designathon.pdf`.
- [ ] Put both files in a folder and compress it as **`Ryzera_Designathon.zip`**.

## 6. Final text pieces
- [ ] AI tool disclosure: complete the "What the team did" part in `07-ai-disclosure.md` and on Story board 15.
- [ ] Core tradeoff (board 13) and style guide (page 10 Style Guide) are included.

## 7. Submit before the deadline (aim for Tuesday afternoon)
- [ ] Upload `Ryzera_Designathon.zip`.
- [ ] Paste the prototype link.
- [ ] Paste the YouTube link.
- [ ] Submit, then screenshot the confirmation.
