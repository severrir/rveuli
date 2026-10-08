/**
 * Seed data for IX კლასი.
 *
 * Due dates are offsets from the moment the app loads, so the board always
 * shows a believable spread — something overdue, something due tomorrow,
 * something next week — whenever anyone opens it. Once Supabase is wired up
 * this file is only used by the offline fallback and by the migration seed.
 */

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/**
 * Today at a given Tbilisi hour, shifted by `days`.
 *
 * The school week runs Monday to Saturday, so a deadline is never allowed
 * to land on a Sunday — it rolls forward to the Monday instead.
 */
function at(days, hour = 9, minute = 0) {
  const base = new Date(Date.now() + days * DAY);
  // 09:00 Tbilisi is 05:00 UTC (UTC+4, no daylight saving).
  let due = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      hour - 4,
      minute,
    ),
  );
  const tbilisiWeekday = new Date(due.getTime() + 4 * HOUR).getUTCDay();
  if (tbilisiWeekday === 0) due = new Date(due.getTime() + DAY);
  return due.toISOString();
}

function ago(hours) {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

export const REPS = [
  { id: "rep-nino", display_name: "ნინო", role: "owner" },
  { id: "rep-giorgi", display_name: "გიორგი", role: "rep" },
  { id: "rep-mariam", display_name: "მარიამ", role: "rep" },
];

export const MOCK_HOMEWORK = [
  {
    id: "hw-01",
    subject: "math",
    title: "კვადრატული განტოლებები — გვ. 142, სავარჯიშო 4–9",
    details:
      "ვიეტის თეორემით ამოხსენით ყველა განტოლება და ამოხსნა სრულად ჩაწერეთ რვეულში. მე-9 სავარჯიშოს შემოწმება დაფაზე იქნება.",
    due_at: at(1, 9),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-nino",
    created_at: ago(5),
    updated_at: null,
  },
  {
    id: "hw-02",
    subject: "geo-lit",
    title: "ვეფხისტყაოსანი — ავთანდილის ანდერძი",
    details:
      "სტროფები 790–805 ზეპირად. ვისაც გასულ კვირას არ უპასუხია, პირველები იკითხებით.",
    due_at: at(1, 11),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-nino",
    created_at: ago(5),
    updated_at: null,
  },
  {
    id: "hw-03",
    subject: "physics",
    title: "შემაჯამებელი — მექანიკური მოძრაობა",
    details:
      "მთელი მესამე თავი: სიჩქარე, აჩქარება, თავისუფალი ვარდნა. ფორმულების ფურცელი თან იქონიეთ, კალკულატორი არ დაგჭირდებათ.",
    due_at: at(3, 10),
    is_pinned: true,
    link_url: null,
    attachments: [],
    created_by: "rep-giorgi",
    created_at: ago(26),
    updated_at: ago(20),
  },
  {
    id: "hw-04",
    subject: "history",
    title: "დავით აღმაშენებელი და დიდგორის ბრძოლა",
    details:
      "§14 წაკითხვა და რვეულში ხუთი მიზეზის ჩამოწერა, რამაც ბრძოლის შედეგი განსაზღვრა.",
    due_at: at(-1, 10),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-mariam",
    created_at: ago(50),
    updated_at: null,
  },
  {
    id: "hw-05",
    subject: "biology",
    title: "უჯრედის აგებულება — სქემა",
    details:
      "დახატეთ მცენარეული და ცხოველური უჯრედი გვერდიგვერდ, ყველა ორგანოიდი ხელით მონიშნეთ. სახელმძღვანელოს სურათის გადმოხატვა არ ჩაითვლება.",
    due_at: at(2, 12),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-nino",
    created_at: ago(30),
    updated_at: null,
  },
  {
    id: "hw-06",
    subject: "english",
    title: "Unit 4 — Present Perfect, workbook გვ. 36–37",
    details:
      "ყველა სავარჯიშო, გარდა მეხუთისა. ახალი სიტყვები ზეპირად — კარნახი ოთხშაბათს იქნება.",
    due_at: at(2, 9),
    is_pinned: false,
    link_url: "https://www.youtube.com/results?search_query=present+perfect",
    attachments: [],
    created_by: "rep-giorgi",
    created_at: ago(28),
    updated_at: null,
  },
  {
    id: "hw-07",
    subject: "chemistry",
    title: "ოქსიდები და ფუძეები — §18",
    details:
      "პარაგრაფის ბოლოს სამივე ამოცანა. რეაქციების განტოლებები კოეფიციენტებით გაასწორეთ.",
    due_at: at(4, 9),
    is_pinned: false,
    link_url: null,
    attachments: [
      { name: "ოქსიდების-ცხრილი.pdf", type: "application/pdf", size: 184320 },
    ],
    created_by: "rep-mariam",
    created_at: ago(14),
    updated_at: null,
  },
  {
    id: "hw-08",
    subject: "geo-lang",
    title: "ზმნის პირიანი ფორმები — სავარჯიშო 12",
    details:
      "ცხრილი სრულად შეავსეთ. ვისაც გასული სავარჯიშო არ აქვს გასწორებული, ისიც მოიტანეთ.",
    due_at: at(0, 14),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-nino",
    created_at: ago(22),
    updated_at: null,
  },
  {
    id: "hw-09",
    subject: "geography",
    title: "საქართველოს მდინარეები — კონტურული რუკა",
    details:
      "მონიშნეთ მტკვარი, რიონი, ენგური, ალაზანი და ივრი. აუზები სხვადასხვა ფერით გამოყავით.",
    due_at: at(5, 10),
    is_pinned: false,
    link_url: null,
    attachments: [
      { name: "კონტურული-რუკა.jpg", type: "image/jpeg", size: 420000 },
    ],
    created_by: "rep-giorgi",
    created_at: ago(40),
    updated_at: null,
  },
  {
    id: "hw-10",
    subject: "german",
    title: "Lektion 3 — ლექსიკა ზეპირად",
    details: "ოცივე სიტყვა თარგმანით. წერითი კარნახი პარასკევს.",
    due_at: at(3, 11),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-mariam",
    created_at: ago(18),
    updated_at: null,
  },
  {
    id: "hw-11",
    subject: "civics",
    title: "ესე — ადამიანის უფლებათა საყოველთაო დეკლარაცია",
    details:
      "ერთი გვერდი, ხელით. აირჩიეთ ერთი მუხლი და ახსენით, რატომ მიგაჩნიათ მნიშვნელოვნად დღეს.",
    due_at: at(6, 9),
    is_pinned: false,
    link_url: "https://www.un.org/en/about-us/universal-declaration-of-human-rights",
    attachments: [],
    created_by: "rep-nino",
    created_at: ago(36),
    updated_at: null,
  },
  {
    id: "hw-12",
    subject: "art",
    title: "ნატურმორტი — ფანქრით",
    details:
      "სამი საგანი, ბუნებრივი განათება. ფურცელი A4, რბილი ფანქარი თან მოიტანეთ.",
    due_at: at(4, 13),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-mariam",
    created_at: ago(44),
    updated_at: null,
  },
  {
    id: "hw-13",
    subject: "music",
    title: "ქართული ხალხური სიმღერები — მოსმენა",
    details:
      "მოისმინეთ „ჩაკრულო“ და „ხასანბეგურა“. რვეულში ჩაწერეთ, რით განსხვავდება მათი მრავალხმიანობა.",
    due_at: at(7, 12),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-giorgi",
    created_at: ago(60),
    updated_at: null,
  },
  {
    id: "hw-14",
    subject: "sport",
    title: "კროსი 1000 მ",
    details: "სპორტული ფორმა და დახურული ფეხსაცმელი სავალდებულოა.",
    due_at: at(2, 8),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-giorgi",
    created_at: ago(33),
    updated_at: null,
  },
  {
    id: "hw-15",
    subject: "math",
    title: "დამატებითი — ამოცანები 15 და 16",
    details:
      "ვისაც გასულ შემაჯამებელში ოთხზე ნაკლები აქვს. დანარჩენებისთვის სურვილისამებრ.",
    due_at: at(-3, 9),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-nino",
    created_at: ago(96),
    updated_at: null,
  },
  {
    id: "hw-16",
    subject: "geo-lit",
    title: "ილია ჭავჭავაძე — „კაცია-ადამიანი?!“",
    details: "პირველი ოთხი თავი. მოქმედ პირთა სია რვეულში.",
    due_at: at(8, 10),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-nino",
    created_at: ago(70),
    updated_at: null,
  },
  {
    id: "hw-17",
    subject: "history",
    title: "პრეზენტაცია — ოქროს ხანა",
    details:
      "სამ-სამი კაცი ჯგუფში, 5 სლაიდი. ჯგუფები უკვე დაყოფილია, სია დაფაზეა.",
    due_at: at(11, 10),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-mariam",
    created_at: ago(80),
    updated_at: null,
  },
  {
    id: "hw-18",
    subject: "physics",
    title: "ლაბორატორიული — სხეულის სიმკვრივის განსაზღვრა",
    details:
      "ანგარიში ცხრილით და გაზომვის ცდომილებით. ვინც გაცდა, მომავალ კვირას ჩააბარებს.",
    due_at: at(9, 10),
    is_pinned: false,
    link_url: null,
    attachments: [],
    created_by: "rep-giorgi",
    created_at: ago(190),
    updated_at: null,
  },
];
