<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
class BackupLog extends Model {
    use HasUuids;
    protected $table = 'backup_log';
    protected $fillable = ['file_name','type','status','drive_file_id','error_message','file_size'];
}
