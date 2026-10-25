(function(){
 'use strict';
 // Only public browser landing pages use this tag. Email bodies, old copies,
 // unsubscribe pages and embedded previews are deliberately not instrumented.
 if(!/^(www\.)?ysabelsociety\.com$/i.test(location.hostname)||window.top!==window.self||window.__ysabelPublicAnalytics)return;
 window.__ysabelPublicAnalytics=true;
 var measurement='G-WDV71MP0DK';
 var here=new URL(location.href),config={page_location:here.origin+here.pathname};
 try{if(document.referrer){var ref=new URL(document.referrer);if(/^https?:$/.test(ref.protocol))config.page_referrer=ref.origin+ref.pathname;}}catch(_){}
 [['utm_source','campaign_source'],['utm_medium','campaign_medium'],['utm_campaign','campaign_name'],['utm_content','campaign_content'],['utm_term','campaign_term']].forEach(function(pair){var value=here.searchParams.get(pair[0]);if(value&&value.length<=150&&/^[\w .:/-]+$/.test(value))config[pair[1]]=value;});
 window.dataLayer=window.dataLayer||[];
 window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
 window.gtag('js',new Date());
 // config sends one automatic page_view. Do not send a second manual one.
 window.gtag('config',measurement,config);
 if(!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')){var tag=document.createElement('script');tag.async=true;tag.src='https://www.googletagmanager.com/gtag/js?id='+measurement;document.head.appendChild(tag);}
 document.addEventListener('click',function(event){if(event.defaultPrevented||event.button!==0||!(event.target instanceof Element))return;var anchor=event.target.closest('a[href]');if(!anchor)return;try{var target=new URL(anchor.getAttribute('href'),here);if(!/^https?:$/.test(target.protocol)||target.origin!==here.origin||target.pathname===here.pathname)return;window.gtag('event','link_click',{link_url:target.origin+target.pathname,link_domain:target.hostname,outbound:false});}catch(_){}},{capture:true,passive:true});
})();
