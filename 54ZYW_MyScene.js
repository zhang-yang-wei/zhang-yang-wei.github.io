// 全局变量
var gl;				// WebGL上下文
var canvas;
var program; 		// shader program
var ctx;	// HUD
var mvStack = [];  // 模视投影矩阵栈，用数组实现，初始为空
var matCamera = mat4();	 // 照相机变换，初始为恒等矩阵
var matReverse = mat4(); // 照相机变换的逆变换，初始为恒等矩阵
var matProj;  // 投影矩阵
var gameTimeCount = 0;//游戏计时
var yRot = 0.0;        // 用于动画的旋转角
var guard1 = vec2();
var guard2 = vec2();
var guard3 = vec2();
var guard4 = vec2();//守卫位置信息
var deltaAngle = 60.0; // 每秒旋转角度
var FlashlightControl = 0;//手电筒开关控制//1为可控制
var upControl = [true,true,true,true,true,true,true,true,true,true];
var WinorLose = 0;//判断游戏胜利或失败,1为胜利,-1游戏失败
// 用于保存W、S、A、D四个方向键的按键状态的数组
var keyDown = [false, false, false, false];
var batteryStatus = [true,true,true,true,true];//电池状态
var batteryNum = 0;//电池数量
var keyNum = 0;//钥匙数量
var keyStatus = [true,true];
var moveControl = true;//碰撞检测
var GuardStatus = true;//守卫状态,false为背对角色
var g = 9.8;				// 重力加速度
var initSpeed = 6; 			// 初始速度 
var jumping = false;	    // 是否处于跳跃过程中
var jumpY = 0;          	// 当前跳跃的高度
var jumpTime = 0;			// 从跳跃开始经历的时间
var devX = 0;
var devY = 0;

var fogOn = false;	//是否启用雾

var textureLoaded = 0;//已加载完毕纹理图
var numTextures = 8;//纹理图总数

//光源对象
var Light = function(){
	this.pos = vec4(1.0,1.0,1.0,0.0);
	this.ambient = vec3(0.2,0.2,0.2);//环境光
	this.diffuse = vec3(1.0,1.0,1.0);//漫反射光
	this.specular = vec3(1.0,1.0,1.0);//镜面反射光
	this.on = true;//光源开关
}
//材质对象
var MaterialObj = function(){
	this.ambient = vec3(0.0,0.0,0.0);
	this.diffuse = vec3(0.8,0.8,0.8);
	this.specular = vec3(0.0,0.0,0.0);
	this.emission = vec3(0.0,0.0,0.0);//发射光
	this.shininess = 10;//高光系数
	this.alpha = 1.0;//透明度
}

var lightSun = new Light();//使用默认光源属性

var lights = [];//光源数组

var lightYellow = new Light();//聚光灯

//开始读取Obj模型，返回OBJModel对象
// var obj1 = loadOBJ("Res\\Saber.obj");
var obj1 = loadOBJ("Res\\untitled.obj");
var programObj;
var attibIndex = new AttribIndex();//programObj中attribute变量索引
var mtlIndex = new MTLIndex();//programObj中材质变量索引

// 定义Obj对象
// 构造函数
var Obj = function(){
	this.numVertices = 0; 		// 顶点个数
	this.vertices = new Array(0); // 用于保存顶点数据的数组
	this.normals = new Array(0);//用于保存法向数据的数组
	this.texcoords = new Array(0);//纹理坐标
	this.vertexBuffer = null;	// 存放顶点数据的buffer对象
	this.normalBuffer = null;//存放法向数据的buffer对象
	this.texBuffer = null;
	this.material = new MaterialObj();
	this.texObj = null;//Texture对象
	//this.color = vec3(1.0, 1.0, 1.0); // 对象颜色，默认为白色
}
//纹理对象（自定义对象，并非WebGL的纹理对象）
var TextureObj = function(pathName,format,mipmapping){
	this.path = pathName;//文件路径
	this.format = format;//数据格式
	this.mipmapping = mipmapping;//是否启用mipmapping
	this.texture = null;//纹理对象
	this.complete = false;//是否完成文件加载
}
//创建纹理对象，纹理加载图
//参数为文件路径，纹理格式
//以及是否启用mipmapping
//返回Texture对象
function loadTexture(path,format,mipmapping){
	//新建一个Texture对象
	var texObj = new TextureObj(path,format,mipmapping);
	var image = new Image();
	if(!image){
		console.log("创建image对象失败!");
		return false;
	}
	//注册图像文件加载完毕事件的响应函数
	image.onload = function(){
		console.log("纹理图" + path + "加载完毕");
		//初始化纹理对象
		initTexture(texObj,image);
		textureLoaded++;//增加已加载的纹理数
		//已加载纹理数如果等于总纹理数就可以开始绘制了
		if(textureLoaded == numTextures)
			requestAnimFrame(render);
	}
	image.src = path;
	console.log("开始加载纹理图:" + path);
	return texObj;
}
function initTexture(texObj,image){
	texObj.texture = gl.createTexture();
	if(!texObj.texture){
		console.log("创建纹理对象失败!");
		return false;
	}
	gl.bindTexture(gl.TEXTURE_2D,texObj.texture);
	//在加载纹理图像时对其沿y轴反转
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);
	//加载纹理图像
	gl.texImage2D(gl.TEXTURE_2D,0,texObj.format,texObj.format,gl.UNSIGNED_BYTE,image);
	if(texObj.mipmapping){
		//自动生成各级分辨率的纹理图
		gl.generateMipmap(gl.TEXTURE_2D);
		//设置插值方式
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
	}
	else
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
	texObj.complete = true;
}
// 初始化缓冲区对象(VBO)
Obj.prototype.initBuffers = function(){
	/*创建并初始化顶点坐标缓冲区对象(Buffer Object)*/
	// 创建缓冲区对象，存于成员变量vertexBuffer中
	this.vertexBuffer = gl.createBuffer(); 
	// 将vertexBuffer绑定为当前Array Buffer对象
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
	// 为Buffer对象在GPU端申请空间，并提供数据
	gl.bufferData(gl.ARRAY_BUFFER,	// Buffer类型
		flatten(this.vertices),		// 数据来源
		gl.STATIC_DRAW	// 表明是一次提供数据，多遍绘制
		);
	// 顶点数据已传至GPU端，可释放内存
	this.vertices.length = 0;
	if(this.texcoords.length != 0){
		/*创建并初始化顶点纹理坐标缓冲区对象(Buffer Object)*/
		// 创建缓冲区对象，存于成员变量vertexBuffer中
		this.texBuffer = gl.createBuffer(); 
		// 将vertexBuffer绑定为当前Array Buffer对象
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
		// 为Buffer对象在GPU端申请空间，并提供数据
		gl.bufferData(gl.ARRAY_BUFFER,	// Buffer类型
			flatten(this.texcoords),		// 数据来源
			gl.STATIC_DRAW	// 表明是一次提供数据，多遍绘制
			);
		// 顶点数据已传至GPU端，可释放内存
		this.texcoords.length = 0;
	}
	if(this.normals.length != 0){
		//创建并初始化顶点法向缓冲区对象（buffer object）
		//创建缓冲区对象，存于成员变量normalBuffer中
		this.normalBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER,this.normalBuffer);
		gl.bufferData(gl.ARRAY_BUFFER,flatten(this.normals),gl.STATIC_DRAW);
		this.normals.length = 0;
	}
}

// 绘制几何对象
// 参数为模视矩阵
Obj.prototype.draw = function(matMV,material,tmpTexObj){
	// 设置为a_Position提供数据的方式
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
	// 为顶点属性数组提供数据(数据存放在vertexBuffer对象中)
	gl.vertexAttribPointer( 
		program.a_Position,	// 属性变量索引
		3,					// 每个顶点属性的分量个数
		gl.FLOAT,			// 数组数据类型
		false,				// 是否进行归一化处理
		0,   // 在数组中相邻属性成员起始位置间的间隔(以字节为单位)
		0    // 第一个属性值在buffer中的偏移量
		);
	// 为a_Position启用顶点数组
	gl.enableVertexAttribArray(program.a_Position);	
	if(this.normalBuffer != null){
		//设置为a_Normal提供数据的方式
		gl.bindBuffer(gl.ARRAY_BUFFER,this.normalBuffer);
		gl.vertexAttribPointer(program.a_Normal,3,gl.FLOAT,false,0,0);
		gl.enableVertexAttribArray(program.a_Normal);	
	}
	if(this.texBuffer != null){
		// 设置为a_Texcoord提供数据的方式
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
		// 为顶点属性数组提供数据(数据存放在normalBuffer对象中)
		gl.vertexAttribPointer( 
			program.a_Texcoord,	// 属性变量索引
			2,					// 每个顶点属性的分量个数
			gl.FLOAT,			// 数组数据类型
			false,				// 是否进行归一化处理
			0,   // 在数组中相邻属性成员起始位置间的间隔(以字节为单位)
			0    // 第一个属性值在buffer中的偏移量
			);
		// 为a_Texcoord启用顶点数组
		gl.enableVertexAttribArray(program.a_Texcoord);	
	}
	
	var mtl;
	if(arguments.length > 1 && arguments[1] != null)//提供材料
		mtl = material;
	else
		mtl = this.material;

	var ambientProducts = [];
	var diffuseProducts = [];
	var specularPorducts = [];
	for(var i = 0;i < lights.length;i++){
		ambientProducts.push(mult(lights[i].ambient,mtl.ambient));
		diffuseProducts.push(mult(lights[i].diffuse,mtl.diffuse));
		specularPorducts.push(mult(lights[i].specular,mtl.specular));
	}
	gl.uniform3fv(program.u_AmbientProduct,flatten(ambientProducts));
	gl.uniform3fv(program.u_DiffuseProduct,flatten(diffuseProducts));
	gl.uniform3fv(program.u_SpecularProduct,flatten(specularPorducts));
	gl.uniform3fv(program.u_Emission,flatten(mtl.emission));
	gl.uniform1f(program.u_Shininess,mtl.shininess);
	gl.uniform1f(program.u_Alpha,mtl.alpha);
	
	// 传颜色
	//gl.uniform3fv(program.u_Color, flatten(this.color));
	//纹理对象不为空则绑定纹理对象
	if(this.texObj != null && this.texObj.complete)
		gl.bindTexture(gl.TEXTURE_2D,this.texObj.texture);
	
	//参数有提供纹理对象则用参数提供的纹理对象，否则用对象自己的纹理对象
	var texObj;
	if(arguments.length > 2 && arguments[2] != null)
		texObj = tmpTexObj;
	else
		texObj = this.texObj;
	//纹理对象不为空则绑定纹理对象
	if(texObj != null && texObj.complete)
		gl.bindTexture(gl.TEXTURE_2D,texObj.texture);
	
	// 开始绘制
	gl.uniformMatrix4fv(program.u_ModelView, false, 
		flatten(matMV)); // 传MV矩阵
	gl.uniformMatrix3fv(program.u_NormalMat, false, 
		flatten(normalMatrix(matMV))); // 传MV矩阵
	gl.drawArrays(gl.TRIANGLES, 0, this.numVertices);
}

// 在y=0平面绘制中心在原点的格状方形地面
// fExtent：决定地面区域大小(方形地面边长的一半)
// fStep：决定线之间的间隔
// 返回地面Obj对象
function buildGround(fExtent, fStep){	
	var obj = new Obj(); // 新建一个Obj对象
	var iterations = 2 * fExtent / fStep;//单次循环次数
	var fTexcoordStep = 40 / iterations;//纹理坐标递增步长
	for(var x = -fExtent,s = 0; x < fExtent; x += fStep,s += fTexcoordStep){
		for(var z = fExtent,t = 0; z > -fExtent; z -= fStep,t += fTexcoordStep){
			// 以(x, 0, z)为左下角的单元四边形的4个顶点
			var ptLowerLeft = vec3(x, 0, z);
			var ptLowerRight = vec3(x + fStep, 0, z);
			var ptUpperLeft = vec3(x, 0, z - fStep);
			var ptUpperRight = vec3(x + fStep, 0, z - fStep);
			
			// 分成2个三角形
			obj.vertices.push(ptUpperLeft);    
			obj.vertices.push(ptLowerLeft);
			obj.vertices.push(ptLowerRight);
			obj.vertices.push(ptUpperLeft);
			obj.vertices.push(ptLowerRight);
			obj.vertices.push(ptUpperRight);
			
			//顶点法向
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			
			//纹理坐标
			obj.texcoords.push(vec2(s,t + fTexcoordStep));
			obj.texcoords.push(vec2(s,t));
			obj.texcoords.push(vec2(s + fTexcoordStep,t));
			obj.texcoords.push(vec2(s,t + fTexcoordStep));
			obj.texcoords.push(vec2(s + fTexcoordStep,t));
			obj.texcoords.push(vec2(s + fTexcoordStep,t + fTexcoordStep));
			
			obj.numVertices += 6;
		}
	}
	obj.material.ambient = vec3(0.1,0.1,0.1);
	obj.material.diffuse = vec3(0.8,0.8,0.8);
	obj.material.specular = vec3(0.1,0.1,0.1);  
	obj.material.emission = vec3(0.0,0.0,0.0);
	obj.material.shininess = 10;
	return obj;
}
function initLights(){
	lights.push(lightSun);
	
	//设置手电筒光
	lightYellow.pos = vec4(0.0,0.0,0.0,1.0);//光源位置
	lightYellow.ambient = vec3(0.1,0.1,0.1);
	lightYellow.diffuse = vec3(1,1,1);
	lightYellow.specular = vec3(1,1,1);
	lightYellow.on = false;
	lights.push(lightYellow);
	
	//为program中光源属性传值
	gl.useProgram(programObj);
	var ambientLight = [];
	ambientLight.push(lightSun.ambient);
	ambientLight.push(lightYellow.ambient);
	gl.uniform3fv(programObj.u_AmbientLight,flatten(ambientLight));
	var diffuseLight = [];
	diffuseLight.push(lightSun.diffuse);
	diffuseLight.push(lightYellow.diffuse);
	gl.uniform3fv(programObj.u_DiffuseLight,flatten(diffuseLight));
	var specularLight = [];
	specularLight.push(lightSun.specular);
	specularLight.push(lightYellow.specular);
	gl.uniform3fv(programObj.u_SpecularLight,flatten(specularLight));
	//给聚光灯参数传值
	gl.uniform3fv(programObj.u_SpotDirection,flatten(vec3(0.0,0.0,-1.0)));//往-z轴方向照射
	gl.uniform1f(programObj.u_SpotCutOff,8);
	gl.uniform1f(programObj.u_SpotExponent,3);//衰减系数
	
	//给聚光灯参数传值
	gl.useProgram(program);
	gl.uniform3fv(program.u_SpotDirection,flatten(vec3(0.0,0.0,-1.0)));//往-z轴方向照射
	gl.uniform1f(program.u_SpotCutOff,8);
	gl.uniform1f(program.u_SpotExponent,3);//衰减系数
	passLightsOn();
}
//光源开关传值
function passLightsOn(){
	var lightsOn = [];
	for(var i = 0;i < lights.length;i++){
		if(lights[i].on)
			lightsOn[i] = 1;
		else
			lightsOn[i] = 0;
	}
	gl.useProgram(program);
	gl.uniform1iv(program.u_LightOn,lightsOn);
	gl.useProgram(programObj);
	gl.uniform1iv(programObj.u_LightOn,lightsOn);
}
// 用于生成一个中心在原点的球的顶点数据(南北极在z轴方向)
// 返回球Obj对象，参数为球的半径及经线和纬线数
function buildSphere(radius, columns, rows){
	var obj = new Obj(); // 新建一个Obj对象
	var vertices = []; // 存放不同顶点的数组

	for (var r = 0; r <= rows; r++){
		var v = r / rows;  // v在[0,1]区间
		var theta1 = v * Math.PI; // theta1在[0,PI]区间

		var temp = vec3(0, 0, 1);
		var n = vec3(temp); // 实现Float32Array深拷贝
		var cosTheta1 = Math.cos(theta1);
		var sinTheta1 = Math.sin(theta1);
		n[0] = temp[0] * cosTheta1 + temp[2] * sinTheta1;
		n[2] = -temp[0] * sinTheta1 + temp[2] * cosTheta1;
		
		for (var c = 0; c <= columns; c++){
			var u = c / columns; // u在[0,1]区间
			var theta2 = u * Math.PI * 2; // theta2在[0,2PI]区间
			var pos = vec3(n);
			temp = vec3(n);
			var cosTheta2 = Math.cos(theta2);
			var sinTheta2 = Math.sin(theta2);
			
			pos[0] = temp[0] * cosTheta2 - temp[1] * sinTheta2;
			pos[1] = temp[0] * sinTheta2 + temp[1] * cosTheta2;
			
			var posFull = mult(pos, radius);
			
			vertices.push(posFull);
		}
	}

	/*生成最终顶点数组数据(使用三角形进行绘制)*/
	var colLength = columns + 1;
	for (var r = 0; r < rows; r++){
		var offset = r * colLength;

		for (var c = 0; c < columns; c++){
			var ul = offset  +  c;						// 左上
			var ur = offset  +  c + 1;					// 右上
			var br = offset  +  (c + 1 + colLength);	// 右下
			var bl = offset  +  (c + 0 + colLength);	// 左下

			// 由两条经线和纬线围成的矩形
			// 分2个三角形来画
			obj.vertices.push(vertices[ul]); 
			obj.vertices.push(vertices[bl]);
			obj.vertices.push(vertices[br]);
			obj.vertices.push(vertices[ul]);
			obj.vertices.push(vertices[br]);
			obj.vertices.push(vertices[ur]);
			
			//球的法向与顶点坐标相同
			obj.normals.push(vertices[ul]);
			obj.normals.push(vertices[bl]);
			obj.normals.push(vertices[br]);
			obj.normals.push(vertices[ul]);
			obj.normals.push(vertices[br]);
			obj.normals.push(vertices[ur]);
			
			//纹理坐标
			obj.texcoords.push(vec2(c / columns,r / rows));
			obj.texcoords.push(vec2(c / columns,(r + 1) / rows));
			obj.texcoords.push(vec2((c + 1) / columns,(r + 1) / rows));
			obj.texcoords.push(vec2(c / columns,r / rows));
			obj.texcoords.push(vec2((c + 1) / columns,(r + 1) / rows));
			obj.texcoords.push(vec2((c + 1) / columns,r / rows));
		}
	}

	vertices.length = 0; // 已用不到，释放 
	obj.numVertices = rows * columns * 6; // 顶点数
	obj.material.ambient = vec3(1.0,0.5,0.5);
	obj.material.diffuse = vec3(1.0,0.3,0.3);
	obj.material.specular = vec3(0.3,0.3,0.3);
	obj.material.emission = vec3(0.0,0.0,0.0);
	obj.material.shininess = 50;
	return obj;
}
function buildCube() {
	var obj = new Obj();
	obj.numVertices = 36;	// 绘制立方体使用顶点数(6个面*2个三角形*3个顶点)

	// 为构建立方体传值
	CubeAttribute(2, 0, 1, 3, obj);	// 前   
	CubeNormalAdd(vec3(0,0,1),obj);
	CubeAttribute(4, 6, 7, 5, obj);	// 后
	CubeNormalAdd(vec3(0,0,-1),obj);
	CubeAttribute(1, 0, 4, 5, obj);	// 下
	CubeNormalAdd(vec3(0,-1,0),obj);
	CubeAttribute(7, 6, 2, 3, obj);	// 上
	CubeNormalAdd(vec3(0,1,0),obj);
	CubeAttribute(6, 4, 0, 2, obj);	// 左
	CubeNormalAdd(vec3(-1,0,0),obj);
	CubeAttribute(3, 1, 5, 7, obj);	// 右
	CubeNormalAdd(vec3(1,0,0),obj);
	
	obj.material.ambient = vec3(0.8, 0.8, 0.8);
	obj.material.diffuse = vec3(0.8, 0.8, 0.8);
	obj.material.specular = vec3(0.2, 0.2, 0.2);
	obj.material.emission = vec3(0.0, 0.0, 0.0);
	obj.material.shininess = 0;
	return obj;
}
//立方体法向量
function CubeNormalAdd(a,obj){
	obj.normals.push(a);
	obj.normals.push(a);
	obj.normals.push(a);
	obj.normals.push(a);
	obj.normals.push(a);
	obj.normals.push(a);
}
//立方体的构建
function CubeAttribute(a, b, c, d, obj) {
	var vertices = [// 立方体的8个顶点
		vec3(-0.5,-0.5,0.5),//左下前
		vec3(0.5,-0.5,0.5),//右下前
		vec3(-0.5,0.5,0.5),//左上前
		vec3(0.5,0.5,0.5),//右上前
		vec3(-0.5,-0.5,-0.5),//左下后
		vec3(0.5,-0.5,-0.5),//右下后
		vec3(-0.5,0.5,-0.5),//左上后
		vec3(0.5,0.5,-0.5),//右上后
	];

	obj.texcoords.push(vec2(0.0, 0.0));
	obj.vertices.push(vertices[a]);
	obj.texcoords.push(vec2(1.0, 0.0));
	obj.vertices.push(vertices[b]);
	obj.texcoords.push(vec2(1.0, 1.0));
	obj.vertices.push(vertices[c]);
	obj.texcoords.push(vec2(0.0, 0.0));
	obj.vertices.push(vertices[a]);
	obj.texcoords.push(vec2(1.0, 1.0));
	obj.vertices.push(vertices[c]);
	obj.texcoords.push(vec2(0.0, 1.0));
	obj.vertices.push(vertices[d]);
}
// 构建中心在原点的圆环(由线段构建)
// 参数分别为圆环的主半径(决定环的大小)，
// 圆环截面圆的半径(决定环的粗细)，
// numMajor和numMinor决定模型精细程度
// 返回圆环Obj对象
function buildTorus(majorRadius, minorRadius, numMajor, numMinor){
	var obj = new Obj(); // 新建一个Obj对象
	
	obj.numVertices = numMajor * numMinor * 6; // 顶点数

	var majorStep = 2.0 * Math.PI / numMajor;
	var minorStep = 2.0 * Math.PI / numMinor;
	var sScale = 4,tScale = 2;//两个方向上纹理坐标的缩放系数
	for(var i = 0; i < numMajor; ++i){
		var a0 = i * majorStep;
		var a1 = a0 + majorStep;
		var x0 = Math.cos(a0);
		var y0 = Math.sin(a0);
		var x1 = Math.cos(a1);
		var y1 = Math.sin(a1);

		//三角形条带左右顶点（一上一下）对应的两个圆环中心
		var center0 = mult(majorRadius,vec3(x0,y0,0));
		var center1 = mult(majorRadius,vec3(x1,y1,0));
		
		for(var j = 0; j < numMinor; ++j){
			var b0 = j * minorStep;
			var b1 = b0 + minorStep;
			var c0 = Math.cos(b0);
			var r0 = minorRadius * c0 + majorRadius;
			var z0 = minorRadius * Math.sin(b0);
			var c1 = Math.cos(b1);
			var r1 = minorRadius * c1 + majorRadius;
			var z1 = minorRadius * Math.sin(b1);

			var left0 = vec3(x0*r0, y0*r0, z0);
			var right0 = vec3(x1*r0, y1*r0, z0);
			var left1 = vec3(x0*r1, y0*r1, z1);
			var right1 = vec3(x1*r1, y1*r1, z1);
			obj.vertices.push(left0);  
			obj.vertices.push(right0); 
			obj.vertices.push(left1); 
			obj.vertices.push(left1); 
			obj.vertices.push(right0);
			obj.vertices.push(right1);
			
			//法向从圆环中心指向顶点
			obj.normals.push(subtract(left0,center0));
			obj.normals.push(subtract(right0,center1));
			obj.normals.push(subtract(left1,center0));
			obj.normals.push(subtract(left1,center0));
			obj.normals.push(subtract(right0,center1));
			obj.normals.push(subtract(right1,center1));
			
			//纹理坐标
			obj.texcoords.push(vec2(i / numMajor * sScale,j / numMinor * tScale));
			obj.texcoords.push(vec2((i + 1) / numMajor * sScale,j / numMinor * tScale));
			obj.texcoords.push(vec2(i / numMajor * sScale,(j + 1) / numMinor * tScale));
			obj.texcoords.push(vec2(i / numMajor * sScale,(j + 1) / numMinor * tScale));
			obj.texcoords.push(vec2((i + 1) / numMajor * sScale,j / numMinor * tScale));
			obj.texcoords.push(vec2((i + 1) / numMajor * sScale,(j + 1) / numMinor * tScale));
		}
	}
	obj.material.ambient = vec3(0.1,1.0,0.3);
	obj.material.diffuse = vec3(1.0,0.84,0.0);
	obj.material.specular = vec3(1.0,1.0,1.0);
	obj.material.emission = vec3(0.0,0.0,0.0);
	obj.material.shininess = 50;
	return obj;
}

// 获取shader中变量位置
function getLocation(){
	/*获取shader中attribute变量的位置(索引)*/
    program.a_Position = gl.getAttribLocation(program, "a_Position");
	if(program.a_Position < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Position失败！"); 
	}	
	program.a_Normal = gl.getAttribLocation(program, "a_Normal");
	if(program.a_Normal < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Normal失败！"); 
	}
	program.a_Texcoord = gl.getAttribLocation(program, "a_Texcoord");
	if(program.a_Texcoord < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Texcoord失败！"); 
	}
	/*获取shader中uniform变量的位置(索引)*/
	program.u_ModelView = gl.getUniformLocation(program, "u_ModelView");
	if(!program.u_ModelView){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_ModelView失败！"); 
	}
	program.u_Projection = gl.getUniformLocation(program, "u_Projection");
	if(!program.u_Projection){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Projection失败！"); 
	}
	program.u_NormalMat = gl.getUniformLocation(program, "u_NormalMat");
	if(!program.u_NormalMat){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_NormalMat失败！"); 
	}
	program.u_LightPosition = gl.getUniformLocation(program, "u_LightPosition");
	if(!program.u_LightPosition){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_LightPosition失败！"); 
	}
	program.u_Shininess = gl.getUniformLocation(program, "u_Shininess");
	if(!program.u_Shininess){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Shininess失败！"); 
	}
	program.u_AmbientProduct = gl.getUniformLocation(program, "u_AmbientProduct");
	if(!program.u_AmbientProduct){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_AmbientProduct失败！"); 
	}
	program.u_DiffuseProduct = gl.getUniformLocation(program, "u_DiffuseProduct");
	if(!program.u_DiffuseProduct){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_DiffuseProduct失败！"); 
	}
	program.u_SpecularProduct = gl.getUniformLocation(program, "u_SpecularProduct");
	if(!program.u_SpecularProduct){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpecularProduct失败！"); 
	}
	program.u_Emission = gl.getUniformLocation(program, "u_Emission");
	if(!program.u_Emission){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Emission失败！"); 
	}
	
	program.u_SpotDirection = gl.getUniformLocation(program, "u_SpotDirection");
	if(!program.u_SpotDirection){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotDirection失败！"); 
	}
	program.u_SpotCutOff = gl.getUniformLocation(program, "u_SpotCutOff");
	if(!program.u_SpotCutOff){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotCutOff失败！"); 
	}
	program.u_SpotExponent = gl.getUniformLocation(program, "u_SpotExponent");
	if(!program.u_SpotExponent){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotExponent失败！"); 
	}
	program.u_LightOn = gl.getUniformLocation(program, "u_LightOn");
	if(!program.u_LightOn){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_LightOn失败！"); 
	}
	program.u_Sampler = gl.getUniformLocation(program, "u_Sampler");
	if(!program.u_Sampler){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Sampler失败！"); 
	}
	program.u_Alpha = gl.getUniformLocation(program, "u_Alpha");
	if(!program.u_Alpha){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Alpha失败！"); 
	}
	program.u_bOnlyTexture = gl.getUniformLocation(program, "u_bOnlyTexture");
	if(!program.u_bOnlyTexture){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_bOnlyTexture失败！"); 
	}

	/*获取新片元shader变量的位置(索引)*/
	//雾
	program.u_FogColor = gl.getUniformLocation(program, "u_FogColor");
	if(!program.u_FogColor){ // u_FogColor获取失败则返回null
		console.log("获取uniform变量u_FogColor失败！"); 
	}
	program.u_FogDist = gl.getUniformLocation(program, "u_FogDist");
	if(!program.u_FogDist){ // u_FogDist获取失败则返回null
		console.log("获取uniform变量u_FogDist失败！"); 
	}
	program.u_bFog = gl.getUniformLocation(program, "u_bFog");
	if(!program.u_bFog){ // u_bFog获取失败则返回null
		console.log("获取uniform变量u_bFog失败！"); 
	}
	//attribute变量索引
	attibIndex.a_Position = gl.getAttribLocation(programObj,"a_Position");
	if(attibIndex.a_Position < 0){
		console.log("获取attribute变量a_Position失败！");
	}
	attibIndex.a_Normal = gl.getAttribLocation(programObj,"a_Normal");
	if(attibIndex.a_Normal < 0){
		console.log("获取attribute变量a_Normal失败！");
	}
	attibIndex.a_Texcoord = gl.getAttribLocation(programObj,"a_Texcoord");
	if(attibIndex.a_Texcoord < 0){
		console.log("获取attribute变量a_Texcoord失败！");
	}
	//uniform变量索引
	mtlIndex.u_Ka = gl.getUniformLocation(programObj,"u_Ka");
	if(!mtlIndex.u_Ka){
		console.log("获取uniform变量u_Ka失败！");
	}
	mtlIndex.u_Kd = gl.getUniformLocation(programObj,"u_Kd");
	if(!mtlIndex.u_Kd){
		console.log("获取uniform变量u_Kd失败！");
	}
	mtlIndex.u_Ks = gl.getUniformLocation(programObj,"u_Ks");
	if(!mtlIndex.u_Ks){
		console.log("获取uniform变量u_Ks失败！");
	}
	mtlIndex.u_Ke = gl.getUniformLocation(programObj,"u_Ke");
	if(!mtlIndex.u_Ke){
		console.log("获取uniform变量u_Ke失败！");
	}
	mtlIndex.u_Ns = gl.getUniformLocation(programObj,"u_Ns");
	if(!mtlIndex.u_Ns){
		console.log("获取uniform变量u_Ns失败！");
	}
	mtlIndex.u_d = gl.getUniformLocation(programObj,"u_d");
	if(!mtlIndex.u_d){
		console.log("获取uniform变量u_d失败！");
	}
	programObj.u_ModelView = gl.getUniformLocation(programObj,"u_ModelView");
	if(!programObj.u_ModelView){
		console.log("获取uniform变量u_ModelView失败！");
	}
	programObj.u_Projection = gl.getUniformLocation(programObj,"u_Projection");
	if(!programObj.u_Projection){
		console.log("获取uniform变量u_Projection失败！");
	}
	programObj.u_NormalMat = gl.getUniformLocation(programObj,"u_NormalMat");
	if(!programObj.u_NormalMat){
		console.log("获取uniform变量u_NormalMat失败！");
	}
	programObj.u_LightPosition = gl.getUniformLocation(programObj,"u_LightPosition");
	if(!programObj.u_LightPosition){
		console.log("获取uniform变量u_LightPosition失败！");
	}
	programObj.u_AmbientLight = gl.getUniformLocation(programObj,"u_AmbientLight");
	if(!programObj.u_AmbientLight){
		console.log("获取uniform变量u_AmbientLight失败！");
	}
	programObj.u_DiffuseLight = gl.getUniformLocation(programObj,"u_DiffuseLight");
	if(!programObj.u_DiffuseLight){
		console.log("获取uniform变量u_DiffuseLight失败！");
	}
	programObj.u_SpecularLight = gl.getUniformLocation(programObj,"u_SpecularLight");
	if(!programObj.u_SpecularLight){
		console.log("获取uniform变量u_SpecularLight失败！");
	}
	programObj.u_SpotDirection = gl.getUniformLocation(programObj,"u_SpotDirection");
	if(!programObj.u_SpotDirection){
		console.log("获取uniform变量u_SpotDirection失败！");
	}
	programObj.u_SpotCutOff = gl.getUniformLocation(programObj,"u_SpotCutOff");
	if(!programObj.u_SpotCutOff){
		console.log("获取uniform变量u_SpotCutOff失败！");
	}
	programObj.u_SpotExponent = gl.getUniformLocation(programObj,"u_SpotExponent");
	if(!programObj.u_SpotExponent){
		console.log("获取uniform变量u_SpotExponent失败！");
	}
	programObj.u_LightOn = gl.getUniformLocation(programObj,"u_LightOn");
	if(!programObj.u_LightOn){
		console.log("获取uniform变量u_LightOn失败！");
	}
	programObj.u_Sampler = gl.getUniformLocation(programObj,"u_Sampler");
	if(!programObj.u_Sampler){
		console.log("获取uniform变量u_Sampler失败！");
	}
	programObj.u_FogColor = gl.getUniformLocation(programObj, "u_FogColor");
	if(!programObj.u_FogColor){ // u_FogColor获取失败则返回null
		console.log("获取uniform变量u_FogColor失败！"); 
	}
	programObj.u_FogDist = gl.getUniformLocation(programObj, "u_FogDist");
	if(!programObj.u_FogDist){ // u_FogDist获取失败则返回null
		console.log("获取uniform变量u_FogDist失败！"); 
	}
	programObj.u_bFog = gl.getUniformLocation(programObj, "u_bFog");
	if(!programObj.u_bFog){ // u_bFog获取失败则返回null
		console.log("获取uniform变量u_bFog失败！"); 
	}
}

var ground = buildGround(20.0, 0.1); // 生成地面对象
var numSpheres = 50;  // 场景中球的数目
// 用于保存球位置的数组，对每个球位置保存其x、z坐标
var posSphere = [];  
var sphere = buildSphere(0.2, 15, 15); // 生成球对象

var torus = buildTorus(0.35, 0.15, 40, 20); // 生成圆环对象
var Cube1 = buildCube();//生成立方体对象
var Cube2 = buildCube();//生成立方体对象
var Cube3 = buildCube();//生成立方体对象
var Cube4 = buildCube();
// 初始化场景中的几何对象
function initObjs(){

	// 初始化地面顶点数据缓冲区对象(VBO)
	ground.initBuffers(); 
	ground.texObj = loadTexture("Res\\Cube.bmp",gl.RGB,true);

	// 初始化球顶点数据缓冲区对象(VBO)
	sphere.initBuffers();
	sphere.texObj = loadTexture("Res\\sphere.jpg",gl.RGB,true);

	// 初始化圆环顶点数据缓冲区对象(VBO)
	torus.initBuffers();
	// 初始化圆环纹理
	torus.texObj = loadTexture("Res\\torus.jpg",gl.RGB,true);
	
	// 初始化旋转球纹理
	// lightTexObj = loadTexture("Res\\sun.bmp",gl.RGB,true);
	// 初始化天空球纹理
	skyTexObj1 = loadTexture("Res\\sky.jpg",gl.RGB,true);
	// 初始化立方体顶点数据缓冲区对象(VBO)
	Cube1.initBuffers();
	// 初始化立方体纹理
	Cube1.texObj = loadTexture("Res\\Cube1.bmp",gl.RGB,true);
	Cube2.initBuffers();
	// 初始化立方体纹理
	Cube2.texObj = loadTexture("Res\\Start.bmp",gl.RGB,true);
	Cube3.initBuffers();
	// 初始化立方体纹理
	Cube3.texObj = loadTexture("Res\\End.bmp",gl.RGB,true);
	Cube4.initBuffers();
	// 初始化立方体纹理
	Cube4.texObj = loadTexture("Res\\Cube2.bmp",gl.RGB,true);
}

//雾的开关传值
function passFogOn()
{
	var fog = fogOn ? 1 : 0;
	
	gl.useProgram(program);
	gl.uniform1i(program.u_bFog, fog);
	
	gl.useProgram(programObj);
	gl.uniform1i(programObj.u_bFog, fog);
}

// 页面加载完成后会调用此函数，函数名可任意(不一定为main)
window.onload = function main(){
	// 获取页面中id为webgl的canvas元素
    canvas = document.getElementById("webgl");
	if(!canvas){ // 获取失败？
		alert("获取canvas元素失败！"); 
		return;
	}
	var hud = document.getElementById("hud");
	if(!hud){ // 获取失败？
		alert("获取hud元素失败！"); 
		return;
	}
	ctx = hud.getContext('2d');
	// 利用辅助程序文件中的功能获取WebGL上下文
	// 成功则后面可通过gl来调用WebGL的函数
    gl = WebGLUtils.setupWebGL(canvas,{alpha:false});    
    if (!gl){ // 失败则弹出信息
		alert("获取WebGL上下文失败！"); 
		return;
	}        

	/*设置WebGL相关属性*/
    gl.clearColor(0.0, 0.0, 0.5, 1.0); // 设置背景色为蓝色
	gl.enable(gl.DEPTH_TEST);	// 开启深度检测
	gl.enable(gl.CULL_FACE);	// 开启面剔除
	// 设置视口，占满整个canvas
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.enable(gl.BLEND);//开启混合
	//设置混合方式
	gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
	/*加载shader程序并为shader中attribute变量提供数据*/
	// 加载id分别为"vertex-shader"和"fragment-shader"的shader程序，
	// 并进行编译和链接，返回shader程序对象program
    program = initShaders(gl, "vertex-shader", 
		"fragment-shader");
	//编译链接新的shader程序对象，使用的顶点shader和上面共用
	programObj = initShaders(gl,"vertex-shader","fragment-shaderNew");
		// 获取shader中变量位置
	getLocation();	
	
	// 设置投影矩阵：透视投影，根据视口宽高比指定视域体
	matProj = perspective(35.0, 		// 垂直方向视角
		canvas.width / canvas.height, 	// 视域体宽高比
		0.1, 							// 相机到近裁剪面距离
		200.0);							// 相机到远裁剪面距离
		
	// 初始化场景中的几何对象
	initObjs();
	initLights();
	
	//雾的颜色
	var fogColor = new Float32Array([0.1, 0.1, 0.1]);
	//雾的起点、终点与视点的距离
	var fogDist = new Float32Array([10, 20]);
	
	gl.useProgram(program);	// 启用该shader程序对象 
	
		//雾
	gl.uniform3fv(program.u_FogColor, fogColor);
	gl.uniform2fv(program.u_FogDist, fogDist);
	
	gl.useProgram(program);	// 启用该shader程序对象 
	
	//传投影矩阵
	gl.uniformMatrix4fv(program.u_Projection,false,flatten(matProj));
	//本程序只用了0号纹理单元
	gl.uniform1i(program.u_Sampler,0);
	gl.useProgram(programObj);//启用新的program
	//传同样的投影矩阵
	gl.uniformMatrix4fv(programObj.u_Projection,false,flatten(matProj));

	//雾
	gl.uniform3fv(programObj.u_FogColor, fogColor);
	gl.uniform2fv(programObj.u_FogDist, fogDist);
	
	passFogOn();

};
//鼠标控制视角
var AngleRotate = [0.0,0.0];//绕x轴，绕y轴
window.onclick = function () {
	canvas.requestPointerLock();
}
window.onmousemove = function () {
	if (document.pointerLockElement) {
		devX = event.movementX;
		devY = event.movementY;
	}
	matReverse = mult(matReverse,rotateY(-devX/50));
	matCamera = mult(rotateY(devX/50),matCamera);
	AngleRotate[0] = AngleRotate[0] + devY/50;
}
// 按键响应
window.onkeydown = function(){
	switch(event.keyCode){
		case 87:	// W
			keyDown[0] = true;
			break;
		case 83:	// S
			keyDown[1] = true;
			break;
		case 65:	// A
			keyDown[2] = true;
			break;
		case 68:	// D
			keyDown[3] = true;
			break;
		case 32: 	// space
			if(!jumping){
				jumping = true;
				jumpTime = 0;
			}
			break;
		case 49://1
			if(FlashlightControl == 1){
				lights[1].on = !lights[1].on;
				passLightsOn();
				break;
			}
	}
	// 禁止默认处理(例如上下方向键对滚动条的控制)
	event.preventDefault(); 
}

// 按键弹起响应
window.onkeyup = function(){
	switch(event.keyCode){
		case 87:	// W
			keyDown[0] = false;
			break;
		case 83:	// S
			keyDown[1] = false;
			break;
		case 65:	// A
			keyDown[2] = false;
			break;
		case 68:	// D
			keyDown[3] = false;
			break;
	}
}

// 记录上一次调用函数的时刻
var last = Date.now();
var GuardTimeCount = 0;//计时器
var GuardTimeSet;//背面等待时间
// 根据时间更新旋转角度
function animation(){
	// 计算距离上次调用经过多长的时间
	var now = Date.now();
	var elapsed = (now - last) / 1000.0; // 秒
	last = now;
	
	// 更新动画状态
	yRot += deltaAngle * elapsed;

	// 防止溢出
    yRot %= 360;
	if(WinorLose == 0){
		gameTimeCount += elapsed;
	}
	//守卫计时 
	var GuardPositiveTime = 4;//守卫正面时间
	if(GuardStatus){
		GuardTimeCount += elapsed;
		if(GuardTimeCount >= GuardPositiveTime){
			GuardTimeSet = Math.random(0,1) * 8;
			GuardTimeCount = 0;
			GuardStatus = false;
		}
	}
	else if(!GuardStatus){
		GuardTimeCount += elapsed;
		if(GuardTimeCount >= GuardTimeSet){
			GuardTimeCount = 0;
			GuardStatus = true;
		}
	}
	// 跳跃处理
	jumpTime += elapsed;
	if(jumping){
		if(upControl[0]){
			jumpY = initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
			if(jumpY <= 0){
				jumpY = 0;
				jumping = false;
			}
		}
		if(!upControl[0]){
			jumpY = 0.5 + initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
			if(jumpY <= 0.5){
				jumpY = 0.5;
				jumping = false;
			}
		}
		if(!upControl[1]){
			jumpY = 1 + initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
			if(jumpY <= 1){
				jumpY = 1;
				jumping = false;
			}
		}
		if(!upControl[2]){
			jumpY = 1.5 + initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
			if(jumpY <= 1.5){
				jumpY = 1.5;
				jumping = false;
			}
		}
		if(!upControl[3]){
			jumpY = 2 + initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
			if(jumpY <= 2){
				jumpY = 2;
				jumping = false;
			}
		}
		if(!upControl[4]){
			jumpY = 2.5 + initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
			if(jumpY <= 2.5){
				jumpY = 2.5;
				jumping = false;
			}
		}
		if(!upControl[5]){
			jumpY = 2 + initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
			if(jumpY <= 2){
				jumpY = 2;
				jumping = false;
			}
		}
		if(!upControl[6]){
			jumpY = 1.5 + initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
			if(jumpY <= 1.5){
				jumpY = 1.5;
				jumping = false;
			}
		}
		if(!upControl[7]){
			jumpY = 1.0 + initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
			if(jumpY <= 1.0){
				jumpY = 1.0;
				jumping = false;
			}
		}
		if(!upControl[8]){
			jumpY = 0.5 + initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
			if(jumpY <= 0.5){
				jumpY = 0.5;
				jumping = false;
			}
		}
		if(!upControl[9]){
			jumpY =initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
			if(jumpY <= 0.0){
				jumpY = 0.0;
				jumping = false;
			}
		}
	}
}

// 更新照相机变换
function updateCamera(){
	// 照相机前进
	if(keyDown[0]){
		matReverse = mult(matReverse, translate(0.0, 0.0, -0.1));
		matCamera = mult(translate(0.0, 0.0,0.1), matCamera);
		if(collision() == true){
			matReverse = mult(matReverse, translate(0.0, 0.0, 0.1));
			matCamera = mult(translate(0.0, 0.0,-0.1), matCamera);
		}
	}
	
	// 照相机后退
	if(keyDown[1]){
		matReverse = mult(matReverse, translate(0.0, 0.0, 0.1));
		matCamera = mult(translate(0.0, 0.0, -0.1), matCamera);
		if(collision() == true){
			matReverse = mult(matReverse, translate(0.0, 0.0, -0.1));
			matCamera = mult(translate(0.0, 0.0, 0.1), matCamera);
		}
	}
	
	// 照相机左走
	if(keyDown[2]){
		matReverse = mult(matReverse, translate(-0.1, 0.0, 0.0));
		matCamera = mult(translate(0.1, 0.0, 0.0), matCamera);
		if(collision() == true){
			matReverse = mult(matReverse, translate(0.1, 0.0, 0.0));
			matCamera = mult(translate(-0.1, 0.0, 0.0), matCamera);
		}
	}
	
	// 照相机右走
	if(keyDown[3]){
		matReverse = mult(matReverse, translate(0.1, 0.0, 0.0));
		matCamera = mult(translate(-0.1, 0.0, 0.0), matCamera);
		// matReverse = mult(matReverse, rotateY(-1));
		// matCamera = mult(rotateY(2), matCamera);
		if(collision() == true){
			matReverse = mult(matReverse, translate(-0.1, 0.0, 0.0));
			matCamera = mult(translate(0.1, 0.0, 0.0), matCamera);
		}
	}
}

// 绘制函数
function render() {
	//检查是否一切就绪，否则请求重绘，并返回
	//这样稍后系统又会调用render重新检查相关状态
	if(!obj1.isAllReady(gl)){
		requestAnimFrame(render);
		return;
	}
	StepControl();
	collision();
	animation(); // 更新动画参数
	updateCamera(); // 更新相机变换
	
	// 清颜色缓存和深度缓存
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // 模视投影矩阵初始化为投影矩阵*照相机变换矩阵

	var matMV = mult(mult(rotate(AngleRotate[0],1, 0, 0),translate(0,-jumpY,0)),matCamera);
	//为光源位置数组传值
	var lightPositions = [];
	lightPositions.push(mult(matMV,lightSun.pos));
	lightPositions.push(lightYellow.pos);
	//传观察坐标系下光源位置/方向
	gl.useProgram(program);
	gl.uniform4fv(program.u_LightPosition,flatten(lightPositions));
	gl.useProgram(programObj);
	gl.uniform4fv(programObj.u_LightPosition,flatten(lightPositions));
	
	gl.useProgram(program);
	//绘制天空球
	gl.disable(gl.CULL_FACE);//关闭背面剔除
	mvStack.push(matMV);//不让天空球变换影响到后面的对象
	matMV = mult(matMV,scale(150.0,150.0,150.0));
	matMV = mult(matMV,rotateX(90));//调整南北极
	gl.uniform1i(program.u_bOnlyTexture,1);
	//天空盒
	Cube1.draw(matMV,null,skyTexObj1);
	gl.uniform1i(program.u_bOnlyTexture,0);
	matMV = mvStack.pop();
	gl.enable(gl.CULL_FACE);

	//开始位置
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0.0, -1, 0));
	matMV = mult(matMV,scale(5,0.25,10));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV, translate(-2.5, 0, 0));
	matMV = mult(matMV,rotateX(90));
	matMV = mult(matMV,scale(0.1,5,5));
	Cube4.draw(matMV);
	matMV = mvStack.pop();
	//楼梯1
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0, -0.7, -5.75));
	matMV = mult(matMV,scale(5,0.35,1.5));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	//楼梯2
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0, -0.35,-7.25));
	matMV = mult(matMV,scale(5,0.35,1.5));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	//楼梯3
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0, 0,-8.75));
	matMV = mult(matMV,scale(5,0.35,1.5));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	//楼梯4
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0, 0.35,-10.25));
	matMV = mult(matMV,scale(5,0.35,1.5));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	//第一关平台
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0, 0.7,-21));
	matMV = mult(matMV,scale(10,0.35,20));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0.0, 0.8,-13));
	matMV = mult(matMV,scale(10,0.2,1));
	Cube2.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0.0, 0.8,-27));
	matMV = mult(matMV,scale(10,0.2,1));
	Cube3.draw(matMV);
	matMV = mvStack.pop();
	//第一关关卡指引
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0.0, 1.5,-12));
	matMV = mult(matMV,rotateY(-yRot));
	matMV = mult(matMV,scale(0.2,0.2,0.2));
	Cube2.draw(matMV);
	matMV = mvStack.pop();
	//第一关怪 绘制Obj模型
	gl.useProgram(programObj);
	mvStack.push(matMV);
	matMV = mult(matMV,translate(0.0,1,-29));
	if(GuardStatus)
		matMV = mult(matMV,rotateY(0));
	else
		matMV = mult(matMV,rotateY(180));
	matMV = mult(matMV,scale(3,3,3));
	gl.uniformMatrix4fv(programObj.u_ModelView,false,flatten(matMV));
	gl.uniformMatrix3fv(programObj.u_NormalMat,false,flatten(normalMatrix(matMV)));
	obj1.draw(gl,attibIndex,mtlIndex,programObj.u_Sampler);
	matMV = mvStack.pop();
	//楼梯5
	gl.useProgram(program);
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-5.75,0.35,-29.25));
	matMV = mult(matMV,scale(1.5,0.35,3.5));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	//楼梯6
	gl.useProgram(program);
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-7.25,0,-29.25));
	matMV = mult(matMV,scale(1.5,0.35,3.5));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	//楼梯7
	gl.useProgram(program);
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-8.75,-0.35,-29.25));
	matMV = mult(matMV,scale(1.5,0.35,3.5));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	//楼梯8
	gl.useProgram(program);
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-10.25,-0.7,-29.25));
	matMV = mult(matMV,scale(1.5,0.35,3.5));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	//第二关平台
	gl.useProgram(program);
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-13,-1.05,-29.25));
	matMV = mult(matMV,scale(4,0.35,20));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV, translate(-35, -0.875,-29.25));
	matMV = mult(matMV,scale(1,0.5,0.5));
	ground.draw(matMV);
	matMV = mvStack.pop();
	//第二关指引
	mvStack.push(matMV);
	matMV = mult(matMV, translate(-12.5,0,-29));
	matMV = mult(matMV,rotateY(-yRot));
	matMV = mult(matMV,scale(0.2,0.2,0.2));
	Cube2.draw(matMV);
	matMV = mvStack.pop();
	//第二关房子
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-15,3.05,-29.25));
	matMV = mult(matMV,scale(0.35,8,20));
	Cube2.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-55,3.05,-29.25));
	matMV = mult(matMV,scale(0.35,8,20));
	Cube3.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-35,3.05,-19.25));
	matMV = mult(matMV,scale(40,8,0.35));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-35,3.05,-39.25));
	matMV = mult(matMV,scale(40,8,0.35));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-35,7.05,-29.25));
	matMV = mult(matMV,scale(40,0.35,20));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	//门
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-55,1.2,-29.25));
	matMV = mult(matMV,scale(0.6,4,2));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-15,1.2,-29.25));
	matMV = mult(matMV,scale(0.6,4,2));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	//第二关怪物
	//守卫1
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-18-yRot/180*15,0,-23.5));
	guard1 = vec2(-18-yRot/180*15,-23.5);
	matMV = mult(matMV,scale(2,4,2));
	sphere.draw(matMV);
	//守卫2
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-18,0,-34.5 + yRot/360*9));
	guard2 = vec2(-18,-34.5 + yRot/360*9);
	matMV = mult(matMV,scale(2,4,2));
	sphere.draw(matMV);
	//守卫3
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-50.5,0,-23.5 - yRot/360*9));
	guard3 = vec2(-50.5,-23.5 - yRot/360*9);
	matMV = mult(matMV,scale(2,4,2));
	sphere.draw(matMV);
	//守卫4
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-50.5 + yRot/180*15,0,-34.5));
	guard4 = vec2(-50.5 + yRot/180*15,-34.5);
	matMV = mult(matMV,scale(2,4,2));
	sphere.draw(matMV);
	matMV = mvStack.pop();
	//结束道路
	gl.useProgram(program);
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-55.75,-1.05,-15.25));
	matMV = mult(matMV,scale(1.5,0.35,30));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	//结束位置
	gl.useProgram(program);
	mvStack.push(matMV);
	matMV = mult(matMV,translate(-55.75,-1.05,2.25));
	matMV = mult(matMV,scale(5,0.35,5));
	Cube1.draw(matMV);
	matMV = mvStack.pop();
	//电池
	if(batteryStatus[0]){
		mvStack.push(matMV);
		matMV = mult(matMV,translate(-17,0,-21));
		matMV = mult(matMV,rotateY(-yRot));
		matMV = mult(matMV,scale(1,1,1));
		Cube1.draw(matMV);
		matMV = mvStack.pop();
	}
	if(batteryStatus[1]){
		mvStack.push(matMV);
		matMV = mult(matMV,translate(-17,0,-37));
		matMV = mult(matMV,rotateY(-yRot));
		matMV = mult(matMV,scale(1,1,1));
		Cube1.draw(matMV);
		matMV = mvStack.pop();
	}
	if(batteryStatus[2]){
		mvStack.push(matMV);
		matMV = mult(matMV,translate(-53,0,-37));
		matMV = mult(matMV,rotateY(-yRot));
		matMV = mult(matMV,scale(1,1,1));
		Cube1.draw(matMV);
		matMV = mvStack.pop();
	}
	if(batteryStatus[3]){
		mvStack.push(matMV);
		matMV = mult(matMV,translate(-53,0,-21));
		matMV = mult(matMV,rotateY(-yRot));
		matMV = mult(matMV,scale(1,1,1));
		Cube1.draw(matMV);
		matMV = mvStack.pop();
	}
	if(batteryStatus[4]){
		mvStack.push(matMV);
		matMV = mult(matMV,translate(-35,0,-29.25));
		matMV = mult(matMV,rotateY(-yRot));
		matMV = mult(matMV,scale(1,1,1));
		Cube1.draw(matMV);
		matMV = mvStack.pop();
	}
	//钥匙
	if(keyStatus[0]){
		mvStack.push(matMV);//使得圆环变换不影响旋转球
		matMV = mult(matMV, translate(-3, 2, -29.2));
		matMV = mult(matMV, rotateY(yRot));
		torus.draw(matMV);
		matMV = mvStack.pop();
	}
	if(keyStatus[1]){
		mvStack.push(matMV);//使得圆环变换不影响旋转球
		matMV = mult(matMV, translate(-55.7, -0.2, -14));
		matMV = mult(matMV, rotateY(yRot));
		torus.draw(matMV);
		matMV = mvStack.pop();
	}
	//关卡二关灯
	if((matReverse[3] >= -15.1 && matReverse[3] <= -14.9) && (matReverse[11] >= -39.25 && matReverse[11] <= -19.25)){
		lightSun.on = false;
		lightYellow.on = true;
		FlashlightControl = 1;
		fogOn = true;
	}
	if((matReverse[3] >= -55.1 && matReverse[3] <= -54.9) && (matReverse[11] >= -39.25 && matReverse[11] <= -19.25)){
		lightSun.on = true;
		lightYellow.on = false;
		fogOn = false;
		FlashlightControl = 0;
	}
	draw2D(ctx);
	passFogOn();	
	passLightsOn();
	Determine();//输赢控制
}
function CalculateDistance(guard){//计算距离
	return Math.sqrt(Math.pow((guard[0]-matReverse[3]),2) + Math.pow((guard[1] - matReverse[11]),2));
}
function Determine(){
	if(CalculateDistance(guard1) <= 1 || CalculateDistance(guard2) <= 1 || CalculateDistance(guard3) <= 1 ||CalculateDistance(guard4) <= 1){
		WinorLose = -1;
		draw2D(ctx);
		return 0;
	}
	if(GuardStatus && (keyDown[0] || keyDown[1] || keyDown[1] || keyDown[2]) && 
	(matReverse[3] >= -5 && matReverse[3] <= 5) && (matReverse[11] >= -27 && matReverse[11] <= -13)){
		WinorLose = -1;
		draw2D(ctx);
		return 0;
	}
	if(keyNum == 2 && (matReverse[3] >= -58.25 && matReverse[3] <= -53.25) && 
	(matReverse[11] >= -0.25 && matReverse[11] <= 4.25)){
		WinorLose = 1;
		draw2D(ctx);
		return 0;
	}
	requestAnimFrame(render); // 请求重绘
}
function draw2D(ctx){
	ctx.clearRect(0, 0, 800, 600); // 清除 <hud>
	if(WinorLose == 1){
		hud.style.backgroundColor="rgb(0.2,0.2,0.2,0.5)";
		ctx.beginPath();                      // 开始绘制
		ctx.moveTo(180, 150); ctx.lineTo(650, 150); 
		ctx.lineTo(650, 380); ctx.lineTo(180, 380);
		ctx.closePath();
		ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // 设置线条的颜色
		ctx.stroke();                           // 用白色的线条绘制三角形
		ctx.font = '100px "Times New Roman"';
		ctx.fillStyle = 'rgba(0, 255, 0.0, 1)'; // 设置文本颜色
		ctx.fillText("通关胜利!", 200, 250);
		ctx.font = '30px "Times New Roman"';
		ctx.fillStyle = 'rgba(0, 0, 0, 1)'; // 设置文本颜色
		ctx.fillText("通关时间:"+gameTimeCount.toFixed(2)+'s',300,300);
		ctx.fillText("重新开始请刷新网页!",275,350);
	}
	else if(WinorLose == -1){
		hud.style.backgroundColor="rgb(0.2,0.2,0.2,0.5)";
		ctx.beginPath();                      // 开始绘制
		ctx.moveTo(180, 150); ctx.lineTo(650, 150); 
		ctx.lineTo(650, 380); ctx.lineTo(180, 380);
		ctx.closePath();
		ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // 设置线条的颜色
		ctx.stroke();                           // 用白色的线条绘制三角形
		ctx.font = '100px "Times New Roman"';
		ctx.fillStyle = 'rgba(255, 0, 0.0, 1)'; // 设置文本颜色
		ctx.fillText("通关失败!", 200, 250);
		ctx.font = '30px "Times New Roman"';
		ctx.fillStyle = 'rgba(255, 0, 0, 1)'; // 设置文本颜色
		ctx.fillText("游玩时间:"+gameTimeCount.toFixed(2)+'s',300,300);
		ctx.fillText("重新开始请刷新网页!",275,350);
	}
	else if(WinorLose == 0){
		ctx.font = '20px "Times New Roman"';
		ctx.fillStyle = 'rgba(255, 255, 255, 1)'; // 设置文本颜色
		ctx.fillText('钥匙数量:'+keyNum, 30, 150);
		if(FlashlightControl == 1)
			ctx.fillText('电池数量:'+batteryNum, 30, 170);
		ctx.fillText('当前坐标:', 30, 190);
		ctx.fillText('X:'+ matReverse[3].toFixed(2)+'\t\t' + 'Y:'+jumpY.toFixed(2)+'\t\t'+'Z:'+matReverse[11].toFixed(2),0,210);
		ctx.fillText('游戏计时:'+gameTimeCount.toFixed(2)+'s', 30, 230);
		ctx.font = '50px "Times New Roman"';
		ctx.fillStyle = 'rgba(255,0, 0, 1)'; // 设置文本颜色
		if((matReverse[3] <= 0.5 && matReverse[3] >= -0.5) && (matReverse[11] <= -11 && matReverse[11] >= -12))
			ctx.fillText("趁着守卫背身尽快过去吧!",130,280);
		if((matReverse[3] <= -12 && matReverse[3] >= -13) && (matReverse[11] <= -28.5 && matReverse[11] >= -29.5)){
			ctx.fillText("房间里一片漆黑,只有一把",100,280);
			ctx.fillText("手电筒,避开那些幽灵,找",100,340);
			ctx.fillText("到电池打开门,逃离这里!",100,400);
		}
	}
}
function StepControl(){
	//第一层阶梯
	if(((matReverse[11]<=-4.95) && (matReverse[11]>-6.45)) && ((matReverse[3]<=2.5) && (matReverse[3]>=-2.5)) && upControl[0])
	{
		jumpY = jumpY + 0.5;
		upControl[0] = false;
	}
	else if((matReverse[11]>-4.95) && ((matReverse[3]<=2.5) && (matReverse[3]>=-2.5)) && !upControl[0])
	{
		jumpY = jumpY - 0.5;
		upControl[0] = true;
	}
	// 第二层阶梯
	if(((matReverse[11]<=-6.45) && (matReverse[11]>-7.95)) && ((matReverse[3]<=2.2) && (matReverse[3]>=-2.5)) && upControl[1])
	{
		jumpY = jumpY + 0.5;
		upControl[1] = false;
	}
	else if((matReverse[11]>-6.45) && ((matReverse[3]<=2.5) && (matReverse[3]>=-2.5)) && !upControl[1])
	{
		jumpY = jumpY - 0.5;
		upControl[1] = true;
	}
	// 第三层阶梯
	if(((matReverse[11]<=-7.95) && (matReverse[11]>-9.45)) && ((matReverse[3]<=2.5) && (matReverse[3]>=-2.5)) && upControl[2])
	{
		jumpY = jumpY + 0.5;
		upControl[2] = false;
	}
	else if((matReverse[11]>-7.95) && ((matReverse[3]<=2.5) && (matReverse[3]>=-2.5)) && !upControl[2])
	{
		jumpY = jumpY - 0.5;
		upControl[2] = true;
	}
	// 第四层阶梯
	if(((matReverse[11]<=-9.45) && (matReverse[11]>-10.95)) && ((matReverse[3]<=2.5) && (matReverse[3]>=-2.5)) && upControl[3])
	{
		jumpY = jumpY + 0.5;
		upControl[3] = false;
	}
	else if((matReverse[11]>-9.45) && ((matReverse[3]<=2.5) && (matReverse[3]>=-2.5)) && !upControl[3])
	{
		jumpY = jumpY - 0.5;
		upControl[3] = true;
	}
	//第一关平台
	if((matReverse[11]<=-10.95) && ((matReverse[3]<=2.5) && (matReverse[3]>=-2.5)) && upControl[4])
	{
		jumpY = jumpY + 0.5;
		upControl[4] = false;
	}
	else if((matReverse[11]>-10.95) && ((matReverse[3]<=2.5) && (matReverse[3]>=-2.5)) && !upControl[4])
	{
		jumpY = jumpY - 0.5;
		upControl[4] = true;
	}
	// 第一阶台阶
	if(((matReverse[3]<=-5) && (matReverse[3]>-6.5)) && ((matReverse[11]<=-27.5) && (matReverse[11]>=-31)) && upControl[5])
	{
		jumpY = jumpY - 0.5;
		upControl[5] = false;
	}
	else if((matReverse[3] > -5) && ((matReverse[11]<=-27.5) && (matReverse[11]>=-31)) && !upControl[5])
	{
		jumpY = jumpY + 0.5;
		upControl[5] = true;
	}
	//第二阶台阶
	if(((matReverse[3]<=-6.5) && (matReverse[3]>-8)) && ((matReverse[11]<=-27.5) && (matReverse[11]>=-31)) && upControl[6])
	{
		jumpY = jumpY - 0.5;
		upControl[6] = false;
	}
	else if((matReverse[3] > -6.5) && ((matReverse[11]<=-27.5) && (matReverse[11]>=-31)) && !upControl[6])
	{
		jumpY = jumpY + 0.5;
		upControl[6] = true;
	}
	// 第三阶台阶
	if(((matReverse[3]<=-8) && (matReverse[3]>-9.5)) && ((matReverse[11]<=-27.5) && (matReverse[11]>=-31)) && upControl[7])
	{
		jumpY = jumpY - 0.5;
		upControl[7] = false;
	}
	else if((matReverse[3] > -8) && ((matReverse[11]<=-27.5) && (matReverse[11]>=-31)) && !upControl[7])
	{
		jumpY = jumpY + 0.5;
		upControl[7] = true;
	}
	// 第四阶台阶
	if(((matReverse[3]<=-9.5) && (matReverse[3]>-11)) && ((matReverse[11]<=-27.5) && (matReverse[11]>=-31)) && upControl[8])
	{
		jumpY = jumpY - 0.5;
		upControl[8] = false;
	}
	else if((matReverse[3] > -9.5) && ((matReverse[11]<=-27.5) && (matReverse[11]>=-31)) && !upControl[8])
	{
		jumpY = jumpY + 0.5;
		upControl[8] = true;
	}
	//第二关平台
	if((matReverse[3]<=-11) && ((matReverse[11]<=-27.5) && (matReverse[11]>=-31)) && upControl[9])
	{
		jumpY = jumpY - 0.5;
		upControl[9] = false;
	}
	else if((matReverse[3]>-11) && ((matReverse[11]<=-27.5) && (matReverse[11]>=-31)) && !upControl[9])
	{
		jumpY = jumpY + 0.5;
		upControl[9] = true;
	}
}
function collision(){
	//边界控制
	if(matReverse[11] >= -10.95 && matReverse[11] <= 5){
		if(Math.abs(matReverse[3] - 2.5) < 0.05 || Math.abs(matReverse[3] + 2.5) < 0.05)
			return true;
	}
	if(matReverse[3] >= -2.5 && matReverse[3] <= 2.5){
		if(Math.abs(matReverse[11] - 5) < 0.05)
			return true;
	}
	if((matReverse[3] >= 2.5 && matReverse[3] <= 5) || (matReverse[3] <= -2.5 && matReverse[3] >= -5))
	{
		if(Math.abs(matReverse[11] + 10.95) < 0.05)
			return true;
	}
	if((matReverse[3] >= -5 && matReverse[3] <= 5) && (Math.abs(matReverse[11] + 31) < 0.05))
		return true;
	if(matReverse[11] >= -31 && matReverse[11] <= -10.95){
		if(Math.abs(matReverse[3] - 5) < 0.05)
			return true;
	}
	if(matReverse[11] >= -27.5 && matReverse[11] <= -10.95){
		if(Math.abs(matReverse[3] + 5) < 0.05)
			return true;
	}
	if(matReverse[3] >= -11&& matReverse[3] <= -5){
		if((Math.abs(matReverse[11] + 31) < 0.05) || (Math.abs(matReverse[11] + 27.5) < 0.05))
			return true;
	}
	if((matReverse[11] >= -39.25 && matReverse[11] <= -31) || (matReverse[11] >= -27.5 && matReverse[11] <= -19.25)){
		if(Math.abs(matReverse[3] + 11) < 0.05)
			return true;
	}
	if((matReverse[3] >= -55&& matReverse[3] <= -11)){
		if((Math.abs(matReverse[11] + 39.05) < 0.05) || (Math.abs(matReverse[11] + 19.45) < 0.05))
			return true;
	}
	if((matReverse[11] <= -19.45 && matReverse[11] >= -28.25) || (matReverse[11] <= -30.25 && matReverse[11] >= -39.25)){
		if((Math.abs(matReverse[3] + 54.8) < 0.05) || (Math.abs(matReverse[3] + 15.2) < 0.05))
			return true;
	}
	//门
	if(batteryNum != 5){
		if(matReverse[11] <= -28.25 && matReverse[11] >= -30.25){
			if(Math.abs(matReverse[3] + 54.8) < 0.05)
				return true;
		}
	}
	if(matReverse[3] <= -55 && matReverse[3] >= -56.5){
		if((Math.abs(matReverse[11] + 30.25) < 0.05))
			return true;
	}
	if(matReverse[11] >= -30.25 && matReverse[11] <= -0.25){
		if((Math.abs(matReverse[3] + 56.5) < 0.05))
			return true;
	}
	if(matReverse[11] >= -19.45 && matReverse[11] <= -0.25){
		if((Math.abs(matReverse[3] + 55) < 0.05))
			return true;
	}
	//电池碰撞
	if((matReverse[3] <= -16.5 && matReverse[3] >= -17.5) && (matReverse[11] <= -20.5 && matReverse[11] >= -21.5) && batteryStatus[0]){
		batteryStatus[0] = false;
		batteryNum += 1;
	}
	if((matReverse[3] <= -16.5 && matReverse[3] >= -17.5) && (matReverse[11] <= -36.5 && matReverse[11] >= -37.5) && batteryStatus[1]){
		batteryStatus[1] = false;
		batteryNum += 1;
	}
	if((matReverse[3] <= -52.5 && matReverse[3] >= -53.5) && (matReverse[11] <= -36.5 && matReverse[11] >= -37.5) && batteryStatus[2]){
		batteryStatus[2] = false;
		batteryNum += 1;
	}
	if((matReverse[3] <= -52.5 && matReverse[3] >= -53.5) && (matReverse[11] <= -20.5 && matReverse[11] >= -21.5) && batteryStatus[3]){
		batteryStatus[3] = false;
		batteryNum += 1;
	}
	if((matReverse[3] <= -34.5 && matReverse[3] >= -35.5) && (matReverse[11] <= -28.75 && matReverse[11] >= -29.75) && batteryStatus[4]){
		batteryStatus[4] = false;
		batteryNum += 1;
	}
	//钥匙碰撞
	if((matReverse[3] <= -2.5 && matReverse[3] >= -3.5) && (matReverse[11] <= -28.7 && matReverse[11] >= -29.7) && keyStatus[0]){
		keyStatus[0] = false;
		keyNum += 1;
	}
	if((matReverse[3] <= -55.2 && matReverse[3] >= -56.2) && (matReverse[11] <= -13.5 && matReverse[11] >= -14.5) && keyStatus[1]){
		keyStatus[1] = false;
		keyNum += 1;
	}
	return false;
}