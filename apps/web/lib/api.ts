export async function api(path:string,init?:RequestInit){return fetch(path,{...init,headers:{"Content-Type":"application/json",...init?.headers}})}
