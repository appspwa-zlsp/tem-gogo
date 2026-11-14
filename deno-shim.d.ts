declare const Deno: { env: {get(name:string):string|undefined}; serve(cb:(req:Request)=>Promise<Response>|Response):void };
