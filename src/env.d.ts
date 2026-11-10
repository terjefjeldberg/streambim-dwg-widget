declare module 'streambim-widget-api' {
 const api: { API: { getProjectId(): Promise<string>; makeApiRequest(options: {url:string; method?:string; accept?:string}):Promise<string> }; connectToParent(target:Window, methods?:object):Promise<void>; connectToChild(target:HTMLIFrameElement,methods?:object):Promise<void>; connectToWindow(target:Window,url:string,methods?:object):Promise<void> };
 export default api;
}
