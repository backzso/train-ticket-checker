import { Config } from './config';

/**
 * TCDD web uygulamasının kendi bundle'ına gömülü olan PROD token'ı.
 *
 * ÖNEMLİ: Bu token teknik olarak "süresi dolmuş" görünür (60 saniyelik exp,
 * Temmuz 2024), ANCAK TCDD'nin API'si exp alanını denetlemez — token yalnızca
 * bir sabit olarak taşınır. Gerçek erişim kontrolü nginx katmanında, isteğin
 * gerçek tarayıcıdan gelip gelmediğine göre yapılır (bkz. fetcher.ts başlıkları).
 *
 * Bu değer, TCDD tarayıcı bundle'ındaki `case "TCDD-PROD"` dalından alınmıştır.
 * TCDD bundle'ı güncellerse buradaki token da güncellenmelidir.
 */
const EMBEDDED_PROD_TOKEN =
  'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJlVFFicDhDMmpiakp1cnUzQVk2a0ZnV196U29MQXZIMmJ5bTJ2OUg5THhRIn0' +
  '.eyJleHAiOjE3MjEzODQ0NzAsImlhdCI6MTcyMTM4NDQxMCwianRpIjoiYWFlNjVkNzgtNmRkZS00ZGY4LWEwZWYtYjRkNzZiYjZlODNjIiwiaXNz' +
  'IjoiaHR0cDovL3l0cC1wcm9kLW1hc3RlcjEudGNkZHRhc2ltYWNpbGlrLmdvdi50cjo4MDgwL3JlYWxtcy9tYXN0ZXIiLCJhdWQiOiJhY2NvdW50' +
  'Iiwic3ViIjoiMDAzNDI3MmMtNTc2Yi00OTBlLWJhOTgtNTFkMzc1NWNhYjA3IiwidHlwIjoiQmVhcmVyIiwiYXpwIjoidG1zIiwic2Vzc2lvbl9z' +
  'dGF0ZSI6IjAwYzM4NTJiLTg1YjEtNDMxNS04OGIwLWQ0MWMxMTcyYzA0MSIsImFjciI6IjEiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsiZGVm' +
  'YXVsdC1yb2xlcy1tYXN0ZXIiLCJvZmZsaW5lX2FjY2VzcyIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsiYWNjb3Vu' +
  'dCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJvcGVu' +
  'aWQgZW1haWwgcHJvZmlsZSIsInNpZCI6IjAwYzM4NTJiLTg1YjEtNDMxNS04OGIwLWQ0MWMxMTcyYzA0MSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxz' +
  'ZSwicHJlZmVycmVkX3VzZXJuYW1lIjoid2ViIiwiZ2l2ZW5fbmFtZSI6IiIsImZhbWlseV9uYW1lIjoiIn0' +
  '.AIW_4Qws2wfwxyVg8dgHRT9jB3qNavob2C4mEQIQGl3urzW2jALPx-e51ZwHUb-TXB-X2RPHakonxKnWG6tDIP5aKhiidzXDcr6pDDoYU5DnQhM' +
  'g1kywyOaMXsjLFjuYN5PAyGUMh6YSOVsg1PzNh-5GrJF44pS47JnB9zk03Pr08napjsZPoRB-5N4GQ49cnx7ePC82Y7YIc-gTew2baqKQPz9_v38' +
  '1Gbm2V38PZDH9KldlcWut7kqQYJFMJ7dkM_entPJn9lFk7R5h5j_06OlQEpWRMQTn9SQ1AYxxmZxBu5XYMKDkn4rzIIVCkdTPJNCt5PvjENjClKF' +
  'eUA1DOg';

/**
 * Kullanılacak token'ı belirler.
 *
 * Öncelik: yapılandırmada TCDD_AUTH_TOKEN verilmişse o, yoksa gömülü token.
 * exp denetimi YAPILMAZ (API zaten denetlemiyor); dolayısıyla "süresi dolmuş"
 * bir token da reddedilmez.
 */
export function resolveAuthToken(config: Config): string {
  return config.trainAuthToken || EMBEDDED_PROD_TOKEN;
}
