import type { Task, Transition } from '@mytask/core';

// Demo data for the playground only. Never imported by product screens.
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const demoTasks: Task[] = [
  {
    id: 'demo:1',
    key: 'PAY-482',
    title: 'Ödeme sayfasında 3D Secure dönüşü hata veriyor',
    status: 'In Progress',
    statusCategory: 'in_progress',
    priority: 'High',
    priorityLevel: 4,
    type: 'Bug',
    project: 'Payments',
    sprint: 'Sprint 24',
    estimateSeconds: 8 * 3600,
    loggedSeconds: 5.5 * 3600,
    storyPoints: 5,
    subtasks: [
      { id: 'demo:1a', key: 'PAY-483', title: 'Callback 500 kök nedeni', status: 'Done', statusCategory: 'done', assignee: { id: 'enes-akköse', name: 'Enes Akköse' }, estimateSeconds: 2 * 3600, loggedSeconds: 2.5 * 3600, url: 'https://example.atlassian.net/browse/PAY-483' },
      { id: 'demo:1b', key: 'PAY-484', title: 'Safari dönüş yönlendirmesini düzelt', status: 'In Progress', statusCategory: 'in_progress', assignee: { id: 'ayşe-yılmaz', name: 'Ayşe Yılmaz' }, description: 'Safari dönüşte cookie SameSite=None olmadığı için oturum düşüyor.\nÇözüm: callback sayfasında yönlendirmeyi POST yerine GET ile yap.', estimateSeconds: 4 * 3600, loggedSeconds: 3 * 3600, url: 'https://example.atlassian.net/browse/PAY-484' },
      { id: 'demo:1c', key: 'PAY-485', title: 'Regresyon testi', status: 'To Do', statusCategory: 'todo', url: 'https://example.atlassian.net/browse/PAY-485' },
      { id: 'demo:1d', key: 'PAY-486', title: 'Eski ödeme akışını kaldır', status: 'Cancel', statusCategory: 'done', url: 'https://example.atlassian.net/browse/PAY-486' },
    ],
    description: 'Banka sayfasından dönüşte callback 500 veriyor.\nSadece Safari üzerinde tekrar ediyor.',
    parent: { key: 'PAY-100', title: 'Ödeme altyapısı yenileme', url: 'https://example.atlassian.net/browse/PAY-100', type: 'Epic' },
    links: [
      { relation: 'is blocked by', blocksThis: true, key: 'OPS-12', title: 'Staging sertifikası', url: 'https://example.atlassian.net/browse/OPS-12', status: 'In Progress', statusCategory: 'in_progress' },
      { relation: 'relates to', key: 'WEB-1093', title: 'Bildirim tercihleri', url: 'https://example.atlassian.net/browse/WEB-1093', status: 'To Do', statusCategory: 'todo' },
    ],
    descriptionParts: [
      { type: 'text', text: 'Banka sayfasından dönüşte callback 500 veriyor.\nSadece Safari üzerinde tekrar ediyor.\nBeklenen: ' },
      { type: 'link', url: 'https://example.atlassian.net/browse/PAY-400', text: 'PAY-400' },
    ],
    url: 'https://example.atlassian.net/browse/PAY-482',
    connectionId: 'demo',
    updatedAt: ago(12),
  },
  {
    id: 'demo:2',
    key: 'WEB-1093',
    title: 'Ayarlar ekranına bildirim tercihleri eklenecek',
    status: 'To Do',
    statusCategory: 'todo',
    priority: 'Medium',
    priorityLevel: 3,
    type: 'Story',
    project: 'Web',
    sprint: 'Sprint 24',
    estimateSeconds: 3 * 3600,
    url: 'https://example.atlassian.net/browse/WEB-1093',
    connectionId: 'demo',
    updatedAt: ago(60 * 26),
  },
  {
    id: 'demo:3',
    key: 'OPS-77',
    title: 'Staging sertifikası yenilendi',
    status: 'Done',
    statusCategory: 'done',
    project: 'Ops',
    url: 'https://example.atlassian.net/browse/OPS-77',
    connectionId: 'demo',
    updatedAt: ago(60 * 24 * 9),
  },
];

/** Worst-case data: long names, unbreakable strings, missing fields, non-Latin text. */
export const worstTasks: Task[] = [
  {
    id: 'worst:1',
    key: 'VERYLONGPROJECTKEY-1234567',
    title:
      'Çok uzun bir başlık: kullanıcı profil sayfasındaki avatar yükleme akışında, dosya boyutu sınırı aşıldığında gösterilen hata mesajı yanlış dilde ve yanlış yerde görünüyor, ayrıca tekrar deneme butonu çalışmıyor',
    status: 'Waiting for customer response from the external vendor',
    statusCategory: 'in_progress',
    priority: 'Highest',
    priorityLevel: 5,
    type: 'Sub-task',
    sprint: 'Customer Experience Platform Q4 Hardening Sprint 7',
    estimateSeconds: 2 * 3600,
    loggedSeconds: 31 * 3600,
    project: 'Customer Experience and Self Service Platform',
    description: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    url: 'https://example.atlassian.net/browse/VERYLONGPROJECTKEY-1234567',
    connectionId: 'demo',
    updatedAt: ago(60 * 24 * 400),
  },
  {
    id: 'worst:2',
    key: 'A-1',
    title: 'x',
    status: '?',
    statusCategory: 'todo',
    url: 'https://example.atlassian.net/browse/A-1',
    connectionId: 'demo',
    updatedAt: ago(0),
  },
  {
    id: 'worst:3',
    key: 'ÜRÜN-9',
    title: '日本語のタイトルとemoji 🚀 karışık metin',
    status: 'İnceleniyor',
    statusCategory: 'in_progress',
    priority: 'Düşük',
    priorityLevel: 2,
    loggedSeconds: 45 * 60,
    url: 'https://example.atlassian.net/browse/URUN-9',
    connectionId: 'demo',
    updatedAt: ago(3),
  },
];

/** A transition with a screen, like Borusan's "Estimated Budget Effort". */
export const demoTransition: Transition = {
  id: 'demo-91',
  name: 'Estimated Budget Effort',
  to: { name: 'Waiting for Approval', category: 'in_progress' },
  allowsComment: true,
  needsInput: false,
  fields: [
    {
      key: 'budget',
      name: 'Budget Item',
      required: true,
      kind: 'select',
      options: [
        { id: '1', name: 'Lead Engine' },
        { id: '2', name: 'Self Service' },
        { id: '3', name: 'Customer Surveys' },
      ],
    },
    { key: 'effort', name: 'Estimated Budget Effort Man/Day', required: true, kind: 'number' },
  ],
};
