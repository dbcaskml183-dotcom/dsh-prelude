// Unsaved personal snippets live only in this page, never localStorage or a model request.
const editors=new WeakMap();
const empty=()=>({id:null,revision:null,name:'',text:'',initialName:'',initialText:'',open:false,message:''});
export class PersonalEditor{
 constructor(){this.state={...empty(),epoch:0};this.listeners=new Set();}
 getSnapshot=()=>this.state;
 subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
 publish(patch){this.state={...this.state,...patch};for(const fn of this.listeners)fn();}
 dirty(){return this.state.name!==this.state.initialName||this.state.text!==this.state.initialText;}
 update(field,value){if(!['name','text'].includes(field)||typeof value!=='string')throw new TypeError('invalid editor field');this.publish({[field]:value,message:''});}
 toggle(){this.publish({open:!this.state.open});}
 begin(item,revision){if(this.dirty()){this.publish({open:true,message:'还有未保存的内容，请先保存或取消编辑。'});return false;}this.publish({id:item.id,revision,name:item.label,text:item.snippet,initialName:item.label,initialText:item.snippet,open:true,message:'',epoch:this.state.epoch+1});return true;}
 reset(){this.publish({...empty(),epoch:this.state.epoch+1});}
 complete(captured,receipt){
  if(captured.epoch!==this.state.epoch)return false;
  if(receipt){const {item,revision}=receipt;if(!item||typeof item.id!=='string'||(captured.id&&item.id!==captured.id)||!Number.isSafeInteger(revision)||revision<=(captured.revision??0)||item.label!==captured.name.trim()||item.snippet!==captured.text.trim()||item.deletedAt!==null)throw new Error('保存结果无法与本次编辑核对；草稿保留，请刷新核对。');}
  if(captured.name!==this.state.name||captured.text!==this.state.text){this.publish({...(receipt?{id:receipt.item.id,revision:receipt.revision,initialName:receipt.item.label,initialText:receipt.item.snippet}:{}),message:'已保存点击时的版本；之后的编辑仍保留，尚未保存。'});return false;}
  this.reset();return true;
 }
 error(text){this.publish({message:text});}
}
export function personalEditorFor(owner){let value=editors.get(owner);if(!value){value=new PersonalEditor();editors.set(owner,value);}return value;}
