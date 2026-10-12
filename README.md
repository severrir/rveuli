# რვეული

საშინაო დავალებების დაფა — რუსთავის №4 საჯარო სკოლა, IX კლასი.

A homework board for one class. Students open a link and read; two or three
**კლასის უფროსი** (class reps) sign in and post. The whole interface is in
Georgian, and it is built for a phone first.

---

## Start it

```bash
npm install
npm run dev
```

It runs immediately with seed data and no backend. To try the rep tools,
press **შესვლა** and sign in with `nino@skola4.ge` / `demo` — a local demo
session that exists only in your browser and disappears once Supabase is
attached.

---

## Attach Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/migrations/0001_init.sql` in the SQL editor. It creates the
   tables, the row-level security policies and the attachments bucket.
3. Copy `.env.example` to `.env` and fill in the two values from
   **Project Settings → Data API**:

   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<publishable key>
   ```

4. Create an account for each rep under **Authentication → Users**, then
   give each one a profile row — this, not the account, is what grants the
   right to post:

   ```sql
   insert into public.profiles (id, display_name, role) values
     ('<user-uuid>', 'ნინო',   'owner'),
     ('<user-uuid>', 'გიორგი', 'rep'),
     ('<user-uuid>', 'მარიამ', 'rep');
   ```

Restart the dev server. The app now reads and writes the real project, and
the demo sign-in is gone.

### How authorisation works

| | Read the board | Post, edit, delete |
|---|---|---|
| Student (no account) | yes | no |
| Signed in, no profile row | yes | no |
| Signed in with a profile row | yes | yes |

**The `profiles` row is the grant, not the account.** That is the whole
permission model, and it means adding or removing a rep is one row.

### Adding a rep — from the app

Sign in as an `owner` and tap the people icon in the header. Fill in a
name, an email and the suggested password, and tap **დამატება**. The
sheet then shows the two lines to pass on — address and password — with a
copy button, because the password is not shown again.

The same sheet removes someone, resets a forgotten password, and decides
who else is an owner. No dashboard, no SQL, no email delivery to configure.

A `rep` posts, edits and deletes homework. An `owner` does all of that and
manages this list, so only an owner sees the icon at all. The app refuses
to leave you with no owners, since nothing in the client could undo that.

Reps are added with a password rather than an invitation link on purpose:
the class is a handful of people who see each other daily, a password read
out at the end of a lesson arrives sooner than mail that needs a verified
sending domain, and nobody waits on a link that landed in spam.

### Adding a rep — from the dashboard

Needed only for the first owner, or if every owner has locked themselves
out. Open `supabase/add-rep.sql`, change the email, password and name at
the top, and run the whole file in **Dashboard → SQL Editor → New query**.
It prints the current list of reps when it finishes.

Running it again for the same email resets that person's password.

Do not create the auth user by hand in SQL without that script: GoTrue
reads several token columns into non-nullable strings, and if they are left
NULL, sign-in fails with the unhelpful "Database error querying schema".
The script sets them.

You can also create the account through **Authentication → Users → Add
user** (tick *Auto Confirm User*) and then grant it:

```sql
insert into public.profiles (id, display_name, role)
select id, 'გიორგი', 'rep' from auth.users where email = 'giorgi@example.com';
```

### Removing a rep

The people sheet does this. By hand, dropping the grant is enough:

```sql
delete from public.profiles
where id = (select id from auth.users where email = 'giorgi@example.com');
```

They keep their account and can still read the board like any student, but
posting stops immediately — even on a session they already hold. Delete the
row in **Authentication → Users** too if you want the account gone entirely;
the sheet in the app always removes both.

### How the owner tools work

Creating an account writes `auth.users` and `auth.identities`, which no
browser-held role may touch. So `0004_people.sql` adds five
security-definer functions — `add_rep`, `list_people`, `remove_rep`,
`set_rep_role`, `set_rep_password` — and each one checks the caller is an
owner before it writes. That keeps the `service_role` key out of the
client, which is the only alternative.

Deleting is soft: the row is kept and hidden, so a mis-tap can be undone
from the toast. Nothing is ever hard-deleted by the app.

---

## წერები

The tab next to the board is the term's written work: საკონტროლო,
შემაჯამებელი, კარნახი, ტესტი, ზეპირი გამოკითხვა and გამოცდა. Each entry
carries the subject, the date and — required, not optional — **what it is
on**, because a date with no subject matter announced is the thing that
makes a class anxious rather than prepared.

It is a separate tab rather than a filter on the board on purpose.
Homework asks "what do I hand in tomorrow" and leaves once it is handed
in; a test asks "how long have I got, and what is it on", sits on the
horizon for weeks, is never ticked done, and is worth reading backwards
through at the end of a term. Past წერები stay, behind a toggle.

The nearest one is named at the top of the tab, and the countdown
deliberately coarsens with distance — "ხვალ", "5 დღეში", "3 კვირაში" —
because nobody revises to the hour, and an exact day count three weeks out
is false precision.

**Adding one notifies the class.** A trigger on the table asks the
`send-reminders` function to send "ფიზიკა — შემაჯამებელი / ხუთშაბათს,
16 ოქტომბერი" the moment a rep saves it, and tapping the notification
opens this tab rather than the board. Students can turn just this off in
the bell settings and keep the evening digest, or the other way round —
the two are different kinds of interruption and get separate switches.

Because the trigger lives on the table, a test added from any device, or
straight from the SQL editor, announces itself the same way. A failure to
send is swallowed: a notification that cannot go out must never cost a rep
the test they just typed in.

## კენჭისყრა

Where the class decides something — a question, two to six answers, one
vote per phone. A rep opens it, closes it by hand or on a timer, and can
reopen it if they closed the wrong one.

Two rules shape it:

- **Nobody sees the numbers until they have voted**, or until the poll
  closes. A running tally shown before the tap turns a vote into a
  bandwagon, and thirty students is small enough that one visible early
  lead decides the rest.
- **Nothing on the screen is red.** Red is the deadline everywhere else in
  this app, so the bars are drawn in the blue pen. A ballot is a decision,
  not something overdue.

A vote can be changed while the poll is open; the other answers stay
offered underneath the results.

### How the ballot is kept secret

`poll_votes` has row-level security on and **no policies at all**, so the
table is unreachable through the API in both directions. A SELECT policy
would publish who voted for what in a class of thirty, which is the one
thing a secret ballot exists to prevent.

Two functions are the only way in. `cast_poll_vote` writes a single
ballot, after checking the poll is open and that the option is really on
it — otherwise a crafted call could invent a choice that appears in the
tally but on no ballot. `poll_tallies` returns counts and nothing else: no
voter key, no who-chose-what.

Identity is a random key the browser generates for itself and keeps in
localStorage. It says nothing about the student, there is no account to tie
it to, and the primary key on `poll_votes` is what actually enforces one
vote per device rather than the client politely declining to ask twice.
Clearing site data earns a second vote — accepted, because the alternative
is thirty teenagers holding accounts in order to settle where the
excursion goes.

## ევენთები

The diary: ექსკურსია, ოლიმპიადა, შეხვედრა, კონცერტი, სპორტული, კლასის
საღამო, დასვენება.

An event is the only thing in the app with a **place**, and with a time
that can be a window rather than a deadline — an excursion leaves at 08:00
and the bus is back at 19:00, while homework is only ever due at a moment.
So the card leads with when and where, not with a countdown, and the end
time is optional because a parents' meeting ends when it ends.

Nothing here is ever "overdue". An event that has passed simply happened,
so its margin rule goes quiet rather than doubling the way an overdue
homework rule does. Past events stay, behind a toggle.

Adding one announces it, through the same trigger the წერები tab uses, with
its own switch in the bell settings.

### The five tabs

დავალებები · წერები · ევენთები · კენჭისყრა · კვირა

**არქივი is no longer a tab.** It is a segmented control inside
დავალებები, which is where it belonged anyway — it is the same homework
seen later, not a separate section. Six tabs at 360px leaves each about
60px, narrower than "დავალებები" can be set without wrapping, so something
had to give and the archive was the least-visited of them. `?view=archive`
still works, and the board tab stays lit while it is open.

## Reminders

Students can turn on an evening notification telling them how much is due
tomorrow, and an announcement when a წერა is set. Tap the bell in the
header to open the settings:

- **On / off** — per device, no account needed.
- **Time** — any hour from 15:00 to 22:00 Tbilisi.
- **Only before a school day** — stays quiet on Saturday evening.
- **When a წერა is set** — the announcement above, separately switchable.
  It ignores the chosen hour and the school-day rule, because both of those
  answer questions about the nightly digest and neither has anything to say
  about a test three weeks out.

Everything applies the moment it is tapped; there is no save button. The
settings live on the push subscription row and are mirrored into
localStorage, so turning reminders off and on again remembers the choice.

### How it is wired

`pg_cron` calls the `send-reminders` edge function once an hour. Each
device stores the hour it wants, so one schedule serves every preference —
the function works out who is due. If nothing is due tomorrow it sends
nothing at all; an app that pings you to say there is no homework gets
muted within a week.

The same function sends the წერა and ევენთი announcements, invoked by a
trigger with `{ action: "announce-test" | "announce-event", id }` instead
of by the clock. It is one
function because it is one VAPID keypair: a second function would need its
own copy of the signing key. The trigger authenticates exactly as the cron
job does — the anon key in `Authorization` to satisfy `verify_jwt`, and
`CRON_INVOKE_KEY` in `x-cron-key` so the anon key alone cannot notify the
class. Both the project URL and the anon key are read from Vault, so
re-pointing at another project needs no edit to the migration.

Each notification carries its own `tag`. The nightly digest replaces itself
— only the newest matters — while a test announcement must not quietly
overwrite a reminder the student has not read yet.

The VAPID keypair is **generated by the function itself on first run** and
the private half is kept in Supabase Vault. There is no key to paste into
a config file, commit, or environment variable, and none to rotate by
hand. `GET /functions/v1/send-reminders?action=key` returns the public half
(which belongs in the client); sending requires an `x-cron-key` header,
also generated in the database, so the public anon key alone cannot fire
notifications at the class.

To re-point this at a different Supabase project, run the migrations and
deploy the function — it provisions its own keys on the first call.

**On iPhone**, Safari only delivers Web Push once the site is on the Home
Screen (iOS 16.4+). The settings sheet detects that and shows the install
steps instead of a permission prompt Safari would refuse.

### Security notes

Several Supabase advisories are left open on purpose:

- **`push_subscriptions` has RLS on and no policies.** That is the point:
  the table is unreachable through the API, and the two functions above are
  the only way in. A SELECT policy would make the endpoint list readable,
  which would let anyone notify the whole class.
- **`poll_votes` has RLS on and no policies**, for the same reason and a
  sharper one: a readable ballot table is a list of who voted for what.
  `cast_poll_vote` and `poll_tallies` are the only way in, and the second
  returns aggregates only.
- **`cast_poll_vote`, `poll_tallies` and `set_push_announce` are callable
  by `anon`.** They have to be — students never sign in. Each validates
  its input and touches one poll or one endpoint; none can read or
  enumerate anything.
- **`save_push_subscription` / `delete_push_subscription` are callable by
  `anon`.** They have to be — students never sign in. Each validates its
  input, touches one endpoint and returns nothing, so neither can read or
  enumerate anything.
- **`pg_net` is installed in `public`.** Its functions live in the `net`
  schema and are not exposed: calling `/rest/v1/rpc/http_post` as `anon`
  returns 404. Moving the extension would risk the cron job for a lint with
  no reachable surface.
- **The five people functions are callable by `authenticated`.** They have
  to be — an owner is a signed-in user, and PostgREST is how the app
  reaches them. Each one's first statement is the owner check, `anon` has
  no EXECUTE at all, and the part that writes `auth.users`
  (`private.write_rep`) is granted to nobody.

Worth fixing when you get a moment: **leaked password protection** is off.
Dashboard → Authentication → Policies.

## Deploy to GitHub Pages

The repository ships a workflow that builds and publishes on every push to
`main`. Once the repo exists on GitHub:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Push to `main`. The site appears at
   `https://<user>.github.io/<repo>/` in a minute or two.

If you attached Supabase, add the same values under
**Settings → Secrets and variables → Actions → New repository secret**:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_VAPID_PUBLIC_KEY`
if you set up reminders. Without them the published site runs on seed data,
which is still a perfectly good demo.

These are build-time values baked into the client bundle, which is correct
for Supabase: the publishable key is designed to be public, and row-level
security — not secrecy — is what stops students writing to the board. Never
put the `service_role` key here.

A project site is served from `/<repo>/`, not the domain root, so the
workflow passes `VITE_BASE=/<repo>/` to the build. Everything else derives
from it: the service worker registers at that scope, and the manifest uses
paths relative to itself. Renaming the repo needs no code change.

`npm run build` also writes `dist/404.html`, because Pages has no rewrite
rules and would otherwise 404 on a refresh.

### Other hosts

`vercel.json` is still here if you prefer Vercel — import the repo, add the
same environment variables, and it builds at the domain root with no base
path. A custom domain on Pages works the same way: set `VITE_BASE=/`.

## How it is built

```
src/
  lib/
    georgian.js      relative dates, weekday cases, Tbilisi time
    subjects.js      the 14 subjects and the paper each one is printed on
    repository.js    one interface; Supabase when configured, seed data when not
    auth.js          rep sign-in (and the local demo session)
    people.js        the owner tools: add, remove, role, password
    tests.js         the six kinds of წერა, and how a countdown reads
    events.js        the eight kinds of ევენთი, and when one is over
    polls.js         this device's ballot key, and how a result is shaped
    doneState.js     the personal tick, localStorage only
    compressImage.js shrinks textbook photos before upload
    push.js          reminder subscription
  hooks/             useHomework, useTests, useEvents, usePolls, useSession,
                     useDone, useNow, useToast
  components/        Navbar, HeroDeadline, FilterBar, HomeworkGrid,
                     HomeworkCard, WeekView, ArchiveView, TestsView,
                     EventsView, PollsView, Sheet, HomeworkSheet, TestSheet,
                     EventSheet, PollSheet, LoginSheet, PeopleSheet,
                     BottomNav, Toast, …
supabase/
  migrations/        schema, RLS, storage, cron
  functions/         the reminder sender
```

Two decisions worth knowing:

- **All dates are computed in Asia/Tbilisi**, never in the device timezone,
  so "ხვალ" means the same thing on every phone in the class.
- **`repository.js` is the only module that knows whether a backend
  exists.** Everything above it calls the same functions either way, which
  is why attaching Supabase is a configuration change rather than a rewrite.

### Design

The visual world is the Georgian school exercise book. Each card carries
the ruling of the notebook that subject actually uses — squared for
მათემატიკა, ფიზიკა and ქიმია, lined for the languages and humanities,
blank for ხელოვნება, მუსიკა and სპორტი — so subjects are recognisable
without a colour-coded badge.

That matters because red is doing one job only: the margin rule down the
left of every card **is** the deadline. Solid when the work is due today or
tomorrow, drawn twice when it is overdue, faint when it is far off, and
extinguished when you tick it done. One mark, one meaning.
